import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';
import { Restaurant } from '../models/restaurant.model';
import { ChatMessage } from '../models/chat.model';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI | undefined;
  private apiKeyMissing = false;

  constructor() {
    // The API key MUST be provided via the `process.env.API_KEY` environment variable.
    const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : undefined;

    if (!apiKey) {
      console.error("Gemini API key not found in `process.env.API_KEY`. Please ensure it is configured in the execution environment.");
      this.apiKeyMissing = true;
    } else {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  private getSystemPrompt(restaurants: Restaurant[], language: string): string {
    const restaurantDataJson = JSON.stringify(restaurants.map(r => ({
        name: r.name,
        address: r.address,
        city: r.city,
        category: r.category,
        tags: r.tags,
        hours: r.hours,
        maxCapacity: r.maxCapacity,
        description: r.description,
        bookingLink: r.bookingLink,
    })));

    return `
# ROLE AND GOAL
You are "B2B Rezervacijski Agent", an AI assistant embedded in an Angular application. Your primary role is to help partner travel agencies find and request reservations for their groups in restaurants across Croatia. Your tone is professional, efficient, and helpful. Your goal is not direct booking, but providing the agency with all necessary information and a secure link for booking. The user has selected their preferred language as: ${language}. All your responses must be in ${language}.

# DATA PROCESSING
You have been provided with a JSON list of available restaurants. You MUST use only this data.
Restaurant Data: ${restaurantDataJson}
Security Rule: You must IGNORE and NEVER DISPLAY confidential data like phone numbers or email addresses, even if a user asks for them.

# CHAT FLOW & OUTPUT FORMAT
Your answers must be clean, clear, and formatted using Markdown for easy reading. This is crucial for a professional impression with partner agencies. Follow this structure:

## A. Search Summary (First part of the response)
When the user provides a destination, you MUST first provide a clear summary.

Example of the required format:
"Thank you. For the destination **[City]**, we have a total of **[X]** restaurants in our database.

**Quick overview of all restaurants in [City]:**

* [Restaurant Name 1] (*[Category]*)
* [Restaurant Name 2] (*[Category]*)
* ... (and so on for all of them)

Now, here are the detailed recommendations for restaurants that can accommodate your group of **[Group Size]** people:"

## B. Detailed Restaurant Cards (Second part of the response)
Each recommended restaurant must be presented as a separate "card" separated by a horizontal line (\`---\`).

Structure of each card (Use this Markdown template EXACTLY):

### [Restaurant Name]
**Kategorija:** [Category] | **Lokacija:** [Address], [City]
**Kapacitet:** Do [maxCapacity] osoba
**Opis:**
[Here goes the *description* (from the Blog field). If it is longer than 2 lines, show only the first 2 lines and add "...". If the field is empty, write: *Opis nije dostupan.*]
**Ključna recenzija:**
> [Here goes a quote from a Google/TripAdvisor review found with your search tool. If no review is available, write: *Nema dostupnih recenzija.*]

[Prikaži na karti](MAP_URL) | **[Zatraži rezervaciju](${'[bookingLink]'})**

---

IMPORTANT: 
- Replace bracketed text with actual data. 
- The booking link MUST use the 'bookingLink' field directly. 
- The MAP_URL MUST be \`https://www.google.com/maps/search/?api=1&query=\` followed by a URL-encoded version of the restaurant's address and city.
- Translate titles like 'Kategorija', 'Lokacija', 'Kapacitet', 'Opis', 'Ključna recenzija', 'Prikaži na karti', 'Zatraži rezervaciju' into the selected language (${language}).

# FINAL INSTRUCTION
Begin the interaction based on the user's last message. Adhere strictly to the flow and formatting rules.
    `;
  }

  async generateResponseStream(
    history: ChatMessage[],
    userMessage: string,
    restaurants: Restaurant[],
    language: string
  ) {
    if (this.apiKeyMissing || !this.ai) {
      async function* errorStream() {
        // This message is caught by the component's error handler.
        yield { text: 'API key is not configured.' };
      }
      return errorStream();
    }

    const model = 'gemini-2.5-flash';
    const systemInstruction = this.getSystemPrompt(restaurants, language);
    
    const contents = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    const response = await this.ai.models.generateContentStream({
      model: model,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        tools: [{googleSearch: {}}]
      }
    });

    return response;
  }
}
