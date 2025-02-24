import { ChatOpenAI } from '@langchain/openai';
import { AIResponse } from './types';
import { VectorMemoryService } from '../memory/VectorMemoryService';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

export class OpenAIService {
  private client: ChatOpenAI;
  private vectorMemory!: VectorMemoryService;
  private chatPrompt: ChatPromptTemplate;

  private constructor() {
    this.client = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Definiujemy template z wykorzystaniem ChatPromptTemplate
    this.chatPrompt = ChatPromptTemplate.fromMessages([
      ["system", `You are Harry, a personal AI assistant with memory capabilities. You can communicate fluently in both English and Polish.

Key traits:
- Your name is Harry
- You have access to user's previous messages and information through the context provided
- You MUST use the context provided to personalize your responses
- You MUST remember and use user's name and preferences from the context
- You're friendly and approachable
- You adapt your language to match the user (Polish or English)

When responding:
- ALWAYS check the context for user's personal information
- If you know user's name from context, use it
- If user asks about their personal information, check the context first
- If you find the information in context, use it
- If you don't find the information in context, admit you don't know
- Keep responses personalized using context information`],
      ["system", `IMPORTANT CONTEXT - READ CAREFULLY:
{context}

Instructions:
1. Use this context to personalize your response
2. If you see user's name in the context, use it
3. If asked about personal information, check this context first
4. Only say you don't remember if you can't find information in this context`],
      new MessagesPlaceholder("history"), // Miejsce na historię konwersacji
      ["human", "{input}"] // Miejsce na wiadomość użytkownika
    ]);
  }

  static async initialize(): Promise<OpenAIService> {
    const service = new OpenAIService();
    service.vectorMemory = await VectorMemoryService.getInstance();
    return service;
  }

  async generateResponse(prompt: string, userId: number): Promise<AIResponse> {
    const userContext = await this.vectorMemory.getUserContext(userId);
    console.log('User context retrieved:', userContext);
    
    // Formatujemy prompt używając template
    const formattedMessages = await this.chatPrompt.formatMessages({
      context: userContext,
      input: prompt,
      history: [], // Możemy dodać historię konwersacji w przyszłości
    });

    const response = await this.client.invoke(formattedMessages);

    // Store messages with proper type
    const isPersonalInfo = this.containsPersonalInfo(prompt);
    await this.vectorMemory.storeMessage(
      userId, 
      prompt, 
      'user',
      isPersonalInfo ? 'personal_info' : 'conversation'
    );
    await this.vectorMemory.storeMessage(
      userId, 
      response.content as string, 
      'assistant',
      isPersonalInfo ? 'personal_info' : 'conversation'
    );

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
      /nazywam się/i,
      /mam na imię/i,
      /mam na imie/i,
      /jestem/i,
      /lubię/i,
      /lubie/i,
      /wolę/i,
      /wole/i,
      /mieszkam/i,
      /mój/i,
      /moj/i,
      /moja/i,
      /moje/i
    ];

    return personalInfoPatterns.some(pattern => pattern.test(message));
  }
} 