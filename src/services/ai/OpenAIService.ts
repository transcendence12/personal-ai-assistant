import OpenAI from 'openai';
import { MessageHistoryService } from '../history/MessageHistoryService';
import { ChatConfigSchema, Message } from '../../types/chat';
import { z } from 'zod';

export class OpenAIService {
  private client: OpenAI;
  private history: MessageHistoryService;
  private config;

  constructor() {
    // Walidacja konfiguracji
    const config = ChatConfigSchema.parse({
      model: 'gpt-4',
      temperature: 0.3,
      maxMessages: 3,
      maxTokens: 500,
    });

    // Walidacja klucza API
    const apiKey = z.string().min(1).parse(process.env.OPENAI_API_KEY);

    this.client = new OpenAI({ apiKey });
    this.history = new MessageHistoryService();
    this.config = config;
  }

  private readonly SYSTEM_PROMPT = `Your name is Harry. You are an experienced freelance mentor specializing in JavaScript and Python ecosystems, web apps, artificial intelligence and automation. Your role is to:

1. Provide expert guidance on:
   - Writing professional and maintainable code
   - Business aspects of freelancing
   - Client communication and project management
   - Portfolio development
   - Finding projects in the Polish market
   - Best practices in software development

2. Keep responses:
   - Practical and actionable
   - Focused on the Polish freelance market when relevant
   - Professional but friendly
   - Concise but informative`;

  async generateResponse(userMessage: string): Promise<string> {
    try {
      // Dodaj wiadomość użytkownika do historii
      this.history.addMessage('user', userMessage);

      // Przygotuj wiadomości dla API
      const messages: Message[] = [
        // System prompt zawsze jako pierwszy
        { role: 'system', content: this.SYSTEM_PROMPT },
        
        // Ostatnie 3 wiadomości z historii (user i assistant)
        ...this.history.getMessages()
      ];

      console.log('Historia konwersacji:', this.history.summarizeConversation());
      console.log('Liczba wiadomości w historii:', this.history.getMessages().length);

      const completion = await this.client.chat.completions.create({
        messages,
        model: this.config.model,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const responseContent = completion.choices[0].message.content || '';
      
      // Dodaj odpowiedź asystenta do historii
      this.history.addMessage('assistant', responseContent);

      return responseContent;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }
} 