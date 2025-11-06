import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';
import { environment } from '../../environments/environment';
import { Restaurant } from '../models/restaurant.model';
import { ChatMessage } from '../models/chat.model';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
Your interaction with the user (an agent from a travel agency) must follow this order:

## Step 1: Initial Destination Query
When the user provides a destination (e.g., "Split"), you MUST FIRST display a concise list of ALL restaurants available in that city from your database. This is a quick overview for the agent.
Example format for this initial list:
"Thank you. In our database for [City], we have the following [X] restaurants. Now I will filter those that fit your group of [number] people.
- [Restaurant Name 1] ([Category])
- [Restaurant Name 2] ([Category])
..."

## Step 2: Filtering and Detailed Recommendations
After the initial list, filter the results based on maxCapacity (must be greater than or equal to the requested group size) and description/tags (for dietary preferences).
For each matching restaurant, you MUST present a detailed card in the following EXACT markdown-like format. Do not add any extra text between cards.

---
### [Restaurant Name]
**Kategorija:** [Category] | **Adresa:** [Address], [City]
**Kapacitet:** [maxCapacity] osoba

**Opis:**
[First 150 characters of the description]...

**Recenzija:**
[Find a relevant review snippet using your search tool. Example: "Google review mentions: 'Excellent service for large groups.'"]

[Prikaži na karti](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('[Address], [City]')})
[Zatraži rezervaciju (preko našeg portala)](${'[bookingLink]'})
---

IMPORTANT: Replace bracketed text with actual data. The booking link MUST use the 'bookingLink' field. The map link MUST be URL-encoded. Translate titles like 'Kategorija', 'Adresa', etc., into the selected language (${language}).

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