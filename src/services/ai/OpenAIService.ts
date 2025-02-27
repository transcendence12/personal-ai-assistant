import OpenAI from 'openai';
import { MessageHistoryService } from '../history/MessageHistoryService';
import { ChatConfigSchema } from '../../types/chat';
import { z } from 'zod';
import { APIError } from 'openai';
import { BOT_CONFIG } from '../../config/config';

export class OpenAIService {
  private client: OpenAI;
  private history: MessageHistoryService;
  private config;
  private readonly SYSTEM_PROMPT = `You are an AI assistant named Harry. You must always:
1. Remember that YOU are Harry - an experienced freelance mentor. Never say you are just an AI without a name.
2. Keep your identity consistent - always introduce yourself as Harry
3. Provide expert guidance on:
   - Writing professional and maintainable code
   - Business aspects of freelancing
   - Client communication and project management
   - Portfolio development
   - Finding projects in the Polish market
   - Best practices in software development
   - Analyze images and provide a detailed description of the image

4. You can also:
   - Process voice messages and respond to spoken questions
   - Understand both Polish and English voice messages (up to 25MB in size)
   - Provide accurate transcriptions of voice messages
   - Help users understand when their voice messages are too long or unclear
   - Maintain context between voice and text messages in the same conversation

5. Keep responses:
   - Practical and actionable
   - Focused on the Polish freelance market when relevant
   - Professional but friendly
   - Concise but informative
   - Consistent whether responding to text or voice messages`;

  constructor() {
    const config = ChatConfigSchema.parse({
      model: 'gpt-4',
      temperature: 0.3,
      maxMessages: 3, // Start with 3 messages, can be changed via command
      maxTokens: 300,
    });

    const apiKey = z.string().min(1).parse(process.env.OPENAI_API_KEY);

    this.client = new OpenAI({ apiKey });
    this.history = new MessageHistoryService({ maxMessages: config.maxMessages });
    this.config = config;
    
    // Add system prompt to history
    this.history.addMessage('system', this.SYSTEM_PROMPT);
  }

  private handleOpenAIError(error: unknown): never {
    if (error instanceof APIError) {
      console.error('OpenAI API Error:', {
        status: error.status,
        message: error.message,
        code: error.code,
        type: error.type
      });
      
      switch (error.status) {
        case 401:
          throw new Error('Nieprawidłowy klucz API OpenAI');
        case 429:
          throw new Error('Przekroczono limit zapytań do API');
        case 500:
          throw new Error('Błąd serwera OpenAI - spróbuj ponownie później');
        default:
          throw new Error(`Błąd API OpenAI: ${error.message}`);
      }
    }

    if (error instanceof z.ZodError) {
      console.error('Validation Error:', error.format());
      throw new Error('Błąd walidacji danych');
    }

    console.error('Unexpected Error:', error);
    throw new Error('Wystąpił nieoczekiwany błąd');
  }

  async generateResponse(userMessage: string): Promise<string> {
    try {
      this.history.addMessage('user', userMessage);
      
      const messages = this.history.getMessages();
      console.log('Current conversation state:');
      console.log(messages.map(m => `[${m.role}]: ${m.content.substring(0, 50)}...`).join('\n'));

      const completion = await this.client.chat.completions.create({
        messages,
        model: this.config.model,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const responseContent = completion.choices[0].message.content || '';
      this.history.addMessage('assistant', responseContent);
      return responseContent;
    } catch (error) {
      return this.handleOpenAIError(error);
    }
  }

  setTemperature(temp: number): void {
    if (temp < 0 || temp > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }
    this.config.temperature = temp;
  }

  getHistory(): MessageHistoryService {
    return this.history;
  }

  getConfig() {
    return {
      temperature: this.config.temperature,
      model: this.config.model,
      maxTokens: this.config.maxTokens
    };
  }

  async analyzeImage(fileUrl: string, caption?: string): Promise<string> {
    try {
      const messages = [
        { role: 'system' as const, content: this.SYSTEM_PROMPT },
        { 
          role: 'user' as const, 
          content: [
            {
              type: 'image_url' as const,
              image_url: { url: fileUrl }
            },
            {
              type: 'text' as const,
              text: caption || 'Describe this image in detail, focusing on the most important elements.'
            }
          ]
        }
      ];

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-2024-04-09',
        messages,
        max_tokens: this.config.maxTokens,
      });

      const response = completion.choices[0].message.content || '';
      return response;
    } catch (error) {
      return this.handleOpenAIError(error);
    }
  }

  async transcribeAudio(fileUrl: string): Promise<string> {
    try {
      // Download the file
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio file: ${response.statusText}`);
      }
      
      const audioData = await response.blob();
      console.log('Audio file details:', {
        size: audioData.size,
        type: audioData.type,
      });

      // Create a File object that OpenAI can handle
      const audioFile = new File(
        [audioData], 
        'audio.ogg',  // Telegram's native format
        { type: 'audio/ogg' }
      );

      // Send to Whisper API with improved error handling
      try {
        const transcription = await this.client.audio.transcriptions.create({
          file: audioFile,
          model: "whisper-1",
          language: BOT_CONFIG.language === 'pl' ? 'pl' : 'en',
          response_format: 'text',
          temperature: 0.2,
        });

        return transcription;
      } catch (error) {
        if (error instanceof APIError && error.status === 413) {
          throw new Error(BOT_CONFIG.language === 'pl' 
            ? 'Plik audio jest zbyt duży. Maksymalny rozmiar to 25MB.'
            : 'Audio file is too large. Maximum size is 25MB.');
        }
        throw error;
      }
    } catch (error) {
      console.error('Transcription Error:', error);
      return this.handleOpenAIError(error);
    }
  }
} 