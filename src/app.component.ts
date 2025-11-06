import { Component, ChangeDetectionStrategy, signal, inject, AfterViewChecked, ElementRef, ViewChild, OnInit, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { GeminiService } from './services/gemini.service';
import { RestaurantDataService } from './services/restaurant-data.service';
import { ChatMessage, ChatRole } from './models/chat.model';
import { Restaurant } from './models/restaurant.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [GeminiService, RestaurantDataService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  
  private geminiService = inject(GeminiService);
  private restaurantDataService = inject(RestaurantDataService);
  private sanitizer = inject(DomSanitizer);

  userInput = signal<string>('');
  messages = signal<ChatMessage[]>([]);
  isLoading = signal<boolean>(false);
  chatState = signal<'language-select' | 'chatting'>('language-select');
  
  private restaurants: Restaurant[] = [];
  private selectedLanguage = signal<string>('Hrvatski');

  ngOnInit(): void {
    this.restaurants = this.restaurantDataService.getRestaurants();
    const welcomeMessage: ChatMessage = {
      role: 'assistant',
      content: "Dobar dan. Ja sam vaš B2B asistent za rezervacije. Molimo odaberite željeni jezik. \n\n Welcome. I am your B2B reservation assistant. Please select your desired language. \n\n Willkommen. Ich bin Ihr B2B-Reservierungsassistent. Bitte wählen Sie Ihre gewünschte Sprache. \n\n Benvenuto. Sono il tuo assistente di prenotazione B2B. Seleziona la lingua desiderata."
    };
    this.messages.set([welcomeMessage]);
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  selectLanguage(language: string): void {
    this.selectedLanguage.set(language);
    this.chatState.set('chatting');
    const langMessage: ChatMessage = {
        role: 'user',
        content: `Jezik postavljen na: ${language}`
    };
    const followUpMessage: ChatMessage = {
        role: 'assistant',
        content: this.getInitialPromptForLanguage(language)
    };
    this.messages.update(msgs => [...msgs, langMessage, followUpMessage]);
  }

  private getInitialPromptForLanguage(language: string): string {
    switch (language) {
      case 'English':
        return "I'd be happy to help you find restaurants for your groups. Please provide:\n- The destination (city or town)\n- The total group size (e.g., 45 people)\n- Any dietary preferences (e.g., vegetarian, gluten-free)?";
      case 'German':
        return "Gerne helfe ich Ihnen, Restaurants für Ihre Gruppen zu finden. Bitte geben Sie an:\n- Das Reiseziel (Stadt oder Ort)\n- Die gesamte Gruppengröße (z.B. 45 Personen)\n- Eventuelle Ernährungspräferenzen (z.B. vegetarisch, glutenfrei)?";
      case 'Italian':
        return "Sarò felice di aiutarvi a trovare ristoranti per i vostri gruppi. Vi prego di fornire:\n- La destinazione (città o paese)\n- La dimensione totale del gruppo (es. 45 persone)\n- Eventuali preferenze alimentari (es. vegetariano, senza glutine)?";
      default: // Croatian
        return "Rado ću vam pomoći pronaći restorane za vaše grupe. Molim vas, navedite:\n- Destinaciju (grad ili mjesto)\n- Ukupnu veličinu grupe (npr. 45 osoba)\n- Eventualne prehrambene preferencije (npr. vegetarijanci, bez glutena)?";
    }
  }
  
  async sendMessage(): Promise<void> {
    const userMessageContent = this.userInput().trim();
    if (!userMessageContent || this.isLoading()) return;

    const userMessage: ChatMessage = { role: 'user', content: userMessageContent };
    this.messages.update(msgs => [...msgs, userMessage]);
    this.userInput.set('');
    this.isLoading.set(true);

    // Add a placeholder for the bot's response
    this.messages.update(msgs => [...msgs, { role: 'assistant', content: '' }]);

    try {
      const stream = await this.geminiService.generateResponseStream(
          this.messages().slice(0, -2), // send history without user's last message
          userMessageContent,
          this.restaurants,
          this.selectedLanguage()
      );
      
      let currentResponse = '';
      for await (const chunk of stream) {
        currentResponse += chunk.text;
        this.messages.update(msgs => {
            const lastMsg = msgs[msgs.length - 1];
            lastMsg.content = currentResponse;
            return [...msgs];
        });
      }

    } catch (error) {
      console.error('Error getting response from Gemini:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'I am sorry, but I encountered an error. Please try again.'
      };
      this.messages.update(msgs => [...msgs.slice(0, -1), errorMessage]); // Replace placeholder with error
    } finally {
      this.isLoading.set(false);
    }
  }

  parseAndSanitize(content: string): SafeHtml {
    let htmlContent = this.sanitizer.sanitize(SecurityContext.HTML, content) || '';
    // Basic Markdown to HTML conversion
    htmlContent = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
    htmlContent = htmlContent.replace(/\n/g, '<br>'); // Newlines
    htmlContent = htmlContent.replace(/\[Prikaži na karti\]\((.*?)\)/g, '<a href="$1" target="_blank" class="text-blue-500 hover:underline">Prikaži na karti</a>');
    htmlContent = htmlContent.replace(/\[Show on map\]\((.*?)\)/g, '<a href="$1" target="_blank" class="text-blue-500 hover:underline">Show on map</a>');
    htmlContent = htmlContent.replace(/\[Zatraži rezervaciju \(preko našeg portala\)\]\((.*?)\)/g, '<a href="$1" target="_blank" class="inline-block bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 mt-2">Zatraži rezervaciju</a>');
    htmlContent = htmlContent.replace(/\[Request booking \(via our portal\)\]\((.*?)\)/g, '<a href="$1" target="_blank" class="inline-block bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 mt-2">Request booking</a>');

    return this.sanitizer.bypassSecurityTrustHtml(htmlContent);
  }


  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }
}