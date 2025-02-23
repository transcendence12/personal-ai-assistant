import { ChatOpenAI } from '@langchain/openai';
import { AIResponse } from './types';
import { VectorMemoryService } from '../memory/VectorMemoryService';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export class OpenAIService {
  private client: ChatOpenAI;
  private vectorMemory!: VectorMemoryService;
  private readonly systemPrompt = `You are Harry, a personal AI assistant with an open-minded personality. You can communicate fluently in both English and Polish.

Key traits:
- Your name is Harry
- You're friendly and approachable
- You adapt your language to match the user (Polish or English)
- You maintain a casual yet professional tone
- You're knowledgeable but humble
- You're open-minded and non-judgmental

When responding:
- If user writes in Polish, respond in Polish
- If user writes in English, respond in English
- Keep responses concise but helpful
- Feel free to use casual language when appropriate
- Show personality while remaining professional

Remember: You're not just an AI, you're Harry - a helpful friend who's there to assist and engage in meaningful conversation.`;

  private constructor() {
    this.client = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  static async initialize(): Promise<OpenAIService> {
    const service = new OpenAIService();
    service.vectorMemory = await VectorMemoryService.getInstance();
    return service;
  }

  async generateResponse(prompt: string, userId: number, context?: string): Promise<AIResponse> {
    const userContext = await this.vectorMemory.getUserContext(userId);
    
    const messages = [
      new SystemMessage(this.systemPrompt),
      new SystemMessage(`User context:\n${userContext}`),
      ...(context ? [new SystemMessage(`Previous conversation:\n${context}`)] : []),
      new HumanMessage(prompt)
    ];

    const response = await this.client.invoke(messages);

    // Store messages
    await this.vectorMemory.storeMessage(userId, prompt, 'user', 
      this.containsPersonalInfo(prompt) ? 'personal_info' : 'conversation'
    );
    await this.vectorMemory.storeMessage(userId, response.content as string, 'assistant', 'conversation');

    return {
      content: response.content as string,
      tokens: 0,
    };
  }

  private containsPersonalInfo(message: string): boolean {
    const personalInfoPatterns = [
      /my name is/i,
      /i am called/i,
      /i like/i,
      /i prefer/i,
      /i live in/i,
      /my favorite/i,
      // Polish patterns
      /nazywam się/i,
      /mam na imię/i,
      /lubię/i,
      /wolę/i,
      /mieszkam w/i,
      /mój ulubiony/i,
      /moja ulubiona/i,
    ];

    return personalInfoPatterns.some(pattern => pattern.test(message));
  }
} 