import { Context } from "grammy";
import { ConversationMemory } from "../services/memory/ConversationMemory";
import { OpenAIService } from "../services/ai/OpenAIService";

export class ChatHandler {
  private aiService: OpenAIService;
  private memories: Map<number, ConversationMemory>;

  private constructor(aiService: OpenAIService) {
    this.aiService = aiService;
    this.memories = new Map();
  }

  static async initialize(): Promise<ChatHandler> {
    const aiService = await OpenAIService.initialize();
    return new ChatHandler(aiService);
  }

  private getMemory(userId: number): ConversationMemory {
    if (!this.memories.has(userId)) {
      this.memories.set(userId, new ConversationMemory());
    }
    return this.memories.get(userId)!;
  }

  async handleMessage(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    const messageText = ctx.message?.text;

    if (!userId || !messageText) return;

    const memory = this.getMemory(userId);
    await memory.addMessage('human', messageText);

    const history = await memory.getHistory();
    
    try {
      const response = await this.aiService.generateResponse(messageText, userId, history);
      await memory.addMessage('ai', response.content);
      await ctx.reply(response.content);
    } catch (error) {
      console.error('Error generating response:', error);
      await ctx.reply('Sorry, I encountered an error while processing your message.');
    }
  }
} 