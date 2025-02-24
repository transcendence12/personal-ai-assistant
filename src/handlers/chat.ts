import { Context } from "grammy";
import { OpenAIService } from "../services/ai/OpenAIService";

export class ChatHandler {
  private aiService: OpenAIService;

  private constructor(aiService: OpenAIService) {
    this.aiService = aiService;
  }

  static async initialize(): Promise<ChatHandler> {
    const aiService = await OpenAIService.initialize();
    return new ChatHandler(aiService);
  }

  async handleMessage(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const messageText = ctx.message?.text;

      if (!userId || !messageText) {
        console.error('Missing userId or messageText');
        return;
      }

      await ctx.api.sendChatAction(userId, "typing");
      const response = await this.aiService.generateResponse(messageText, userId);

      if (response.content) {
        await ctx.reply(response.content);
      }
    } catch (error) {
      console.error('Error in handleMessage:', error);
      await ctx.reply("Przepraszam, wystąpił błąd podczas przetwarzania twojej wiadomości.");
    }
  }
} 