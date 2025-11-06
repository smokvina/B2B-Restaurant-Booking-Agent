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
  printContent = signal<SafeHtml | null>(null);
  
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
            userMessage = 'The application\'s API key is invalid. Please contact an administrator.';
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

  printChat(): void {
    if (typeof window !== 'undefined') {
      const lastAssistantMessage = [...this.messages()].reverse().find(m => m.role === 'assistant' && m.content.includes('###'));

      if (lastAssistantMessage) {
        this.printContent.set(this.parseAndSanitize(lastAssistantMessage.content));
        // Allow Angular to render the print content before triggering print
        setTimeout(() => window.print(), 0);
      } else {
        alert('No restaurant results found in the chat to print.');
      }
    }
  }

  parseAndSanitize(content: string): SafeHtml {
    // Sanitize the raw content to prevent XSS attacks.
    let processedContent = this.sanitizer.sanitize(SecurityContext.HTML, content) || '';

    // --- Block-level Markdown Conversion ---
    // Process content in chunks separated by one or more blank lines.
    const blocks = processedContent.split(/(\n\s*){2,}/);
    
    const htmlBlocks = blocks.map(block => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) return '';

      // Headers (### Title)
      if (trimmedBlock.startsWith('### ')) {
        return `<h3>${trimmedBlock.substring(4)}</h3>`;
      }
      // Horizontal Rules (---)
      if (trimmedBlock === '---') {
        return '<hr>';
      }
      // Blockquotes (> Quote)
      if (trimmedBlock.startsWith('> ')) {
        const quoteContent = trimmedBlock.split('\n').map(line => line.replace(/^\s*>\s?/, '')).join('<br>');
        return `<blockquote>${quoteContent}</blockquote>`;
      }
      // Unordered Lists (* Item)
      if (trimmedBlock.startsWith('* ')) {
        const listItems = trimmedBlock.split('\n').map(item => 
          `<li>${item.replace(/^\s*\*\s?/, '')}</li>`
        ).join('');
        return `<ul>${listItems}</ul>`;
      }
      // Default: Treat as a paragraph. Replace single newlines within the block with <br>.
      return `<p>${trimmedBlock.replace(/\n/g, '<br>')}</p>`;
    });

    let htmlContent = htmlBlocks.join('');

    // --- Inline-level Markdown Conversion ---

    // Combined Map and Booking link format
    htmlContent = htmlContent.replace(
      /\[(.*?)\]\((.*?)\)\s*\|\s*\*\*\[(.*?)\]\((.*?)\)\*\*/g,
      (match, mapText, mapUrl, bookText, bookUrl) => {
        const mapLink = `<a href="${mapUrl}" target="_blank">${mapText}</a>`;
        const bookingLink = `<a href="${bookUrl}" target="_blank"><strong>${bookText}</strong></a>`;
        // Add 'not-prose' to prevent typography styles from breaking the flex layout
        return `<div class="mt-4 not-prose flex items-center gap-x-4">${mapLink}<span class="text-gray-400 dark:text-gray-500">|</span>${bookingLink}</div>`;
      }
    );

    // Bold (**text**)
    htmlContent = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic (*text*)
    htmlContent = htmlContent.replace(/\*(.*?)\*/g, '<i>$1</i>');
    
    // Linkify any raw URLs that are not already part of an <a> tag
    const urlRegex = /(href="https?:\/\/[^\s"]+")|(https?:\/\/[^\s<]+)/g;
    htmlContent = htmlContent.replace(urlRegex, (match, inHref, rawUrl) => {
      if (inHref) {
        return match; // It's already part of an <a> tag attribute, leave it alone.
      }
      if (rawUrl) {
        // Apply link colors manually as this might be outside the `prose` scope
        return `<a href="${rawUrl}" target="_blank" class="text-[#007BFF] dark:text-[#4D9FFF] hover:underline">${rawUrl}</a>`;
      }
      return match;
    });

    // Wrap each generated restaurant section in a div for print styling
    htmlContent = htmlContent.replace(/(<h3>[\s\S]*?)(?=<h3>|$)/g, '<div class="restaurant-card">$1</div>');

    // Trust the final, sanitized, and formatted HTML
    return this.sanitizer.bypassSecurityTrustHtml(htmlContent);
  }


  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }
}