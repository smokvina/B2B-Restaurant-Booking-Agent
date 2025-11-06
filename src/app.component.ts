import { Component, ChangeDetectionStrategy, signal, inject, AfterViewChecked, ElementRef, ViewChild, OnInit, SecurityContext } from '@angular/core';
import { DOCUMENT, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { GeminiService } from './services/gemini.service';
import { RestaurantDataService } from './services/restaurant-data.service';
import { ChatMessage } from './models/chat.model';
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
  private document = inject(DOCUMENT);

  userInput = signal<string>('');
  messages = signal<ChatMessage[]>([]);
  isLoading = signal<boolean>(false);
  chatState = signal<'language-select' | 'chatting'>('language-select');
  theme = signal<'light' | 'dark'>('light');
  
  private restaurants: Restaurant[] = [];
  private selectedLanguage = signal<string>('Hrvatski');

  constructor() {
    this.initializeTheme();
  }

  ngOnInit(): void {
    this.restaurants = this.restaurantDataService.getRestaurants();
    const welcomeMessage: ChatMessage = {
      role: 'assistant',
      content: "Dobar dan. Ja sam vaš B2B asistent za rezervacije. Molimo odaberite željeni jezik. \n\n Welcome. I am your B2B reservation assistant. Please select your desired language. \n\n Willkommen. Ich bin Ihr B2B-Reservierungsassistent. Bitte wählen Sie Ihre gewünschte Sprache. \n\n Benvenuto. Sono il tuo assistente di prenotazione B2B. Seleziona la lingua desiderata."
    };
    this.messages.set([welcomeMessage]);
  }
  
  private initializeTheme(): void {
    if (typeof window !== 'undefined') {
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
        this.theme.set(currentTheme);
        this.updateTheme(currentTheme);
    }
  }

  toggleTheme(): void {
    this.theme.update(current => {
      const newTheme = current === 'light' ? 'dark' : 'light';
      this.updateTheme(newTheme);
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', newTheme);
      }
      return newTheme;
    });
  }

  private updateTheme(theme: 'light' | 'dark'): void {
    if (theme === 'dark') {
      this.document.documentElement.classList.add('dark');
    } else {
      this.document.documentElement.classList.remove('dark');
    }
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
          this.messages().slice(0, -2), // send history without user's last message and placeholder
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
      this.handleError(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private handleError(error: unknown): void {
    console.error('Error getting response from Gemini:', error); // Log the full error for debugging

    let userMessage = 'Sorry, I encountered a problem and could not complete your request. Please try again later.';

    if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('api key not valid')) {
            userMessage = 'There is an issue with the API key configuration. Please contact support.';
        } else if (errorMessage.includes('429') || errorMessage.includes('resource has been exhausted')) {
            userMessage = 'I am currently experiencing high demand. Please wait a moment and try again.';
        } else if (errorMessage.includes('network') || errorMessage.includes('failed to fetch')) {
            userMessage = 'I am having trouble connecting to the network. Please check your internet connection and try again.';
        } else if (errorMessage.includes('candidate was blocked due to safety')) {
            userMessage = 'The response was blocked due to safety settings. Please rephrase your request.';
        } else if (errorMessage.includes('api key is not configured')) {
            userMessage = 'API key is not configured. Please add your Gemini API key to `src/environments/environment.ts` to enable AI features.';
        }
    }
    
    const errorMessage: ChatMessage = {
      role: 'assistant',
      content: userMessage
    };

    // Replace the loading placeholder with the error message
    this.messages.update(msgs => [...msgs.slice(0, -1), errorMessage]);
  }

  parseAndSanitize(content: string): SafeHtml {
    let htmlContent = this.sanitizer.sanitize(SecurityContext.HTML, content) || '';

    // Convert newlines to breaks first
    htmlContent = htmlContent.replace(/\n/g, '<br>');

    // Handle Markdown elements for structure and emphasis
    htmlContent = htmlContent.replace(/^\s*### (.*$)/gim, '<h3 class="text-xl font-bold mt-4 mb-2">$1</h3>');
    htmlContent = htmlContent.replace(/^\s*---/gm, '<hr class="my-6 border-gray-200 dark:border-gray-700">');
    htmlContent = htmlContent.replace(/^\s*>\s?(.*$)/gim, '<blockquote class="border-l-4 border-gray-300 pl-4 italic my-2 text-gray-600 dark:border-gray-500 dark:text-gray-400">$1</blockquote>');
    htmlContent = htmlContent.replace(/<br>\s*\*\s/g, '<br>&bull; '); // Replace list markers
    htmlContent = htmlContent.replace(/^\s*\*\s/g, '&bull; '); // Handle first list item
    
    htmlContent = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
    htmlContent = htmlContent.replace(/\*(.*?)\*/g, '<i>$1</i>'); // Italic

    // Handle combined Map and Booking link format
    htmlContent = htmlContent.replace(
      /\[(.*?)\]\((.*?)\)\s*\|\s*\*\*\[(.*?)\]\((.*?)\)\*\*/g,
      (match, mapText, mapUrl, bookText, bookUrl) => {
        const mapLink = `<a href="${mapUrl}" target="_blank" class="text-[#007BFF] hover:underline dark:text-[#4D9FFF]">${mapText}</a>`;
        const bookingLink = `<a href="${bookUrl}" target="_blank" class="font-bold text-[#007BFF] hover:underline dark:text-[#4D9FFF]">${bookText}</a>`;
        
        return `<div class="mt-4 flex items-center gap-x-4">${mapLink}<span class="text-gray-400 dark:text-gray-500">|</span>${bookingLink}</div>`;
      }
    );
    
    // Fallback for single booking link in case the model provides it
    htmlContent = htmlContent.replace(
      /\*\*\[(Zatraži rezervaciju|Request booking)\]\((.*?)\)\*\*/g,
      '<a href="$2" target="_blank" class="inline-block bg-[#007BFF] text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 mt-2 dark:bg-[#4D9FFF] dark:hover:bg-blue-500">$1</a>'
    );

    // Linkify raw URLs without using negative lookbehind for wider browser compatibility.
    // This regex captures either an existing href attribute's value or a raw URL.
    const urlRegex = /(href="https?:\/\/[^\s"]+")|(https?:\/\/[^\s<]+)/g;
    htmlContent = htmlContent.replace(urlRegex, (match, inHref, rawUrl) => {
      // If the URL is already inside an href attribute (inHref group matched), return the match as is.
      if (inHref) {
        return match;
      }
      // If it's a raw URL (rawUrl group matched), wrap it in an <a> tag.
      if (rawUrl) {
        return `<a href="${rawUrl}" target="_blank" class="text-[#007BFF] hover:underline dark:text-[#4D9FFF]">${rawUrl}</a>`;
      }
      // Fallback, should not be reached with this regex.
      return match;
    });


    return this.sanitizer.bypassSecurityTrustHtml(htmlContent);
  }


  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }
}