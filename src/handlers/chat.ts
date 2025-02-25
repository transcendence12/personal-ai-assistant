import { Context } from "grammy";
import { OpenAIService } from "../services/ai/OpenAIService";
import { z } from "zod";

const MessageContextSchema = z.object({
  message: z.object({
    text: z.string(),
  }),
  chat: z.object({
    id: z.number(),
  }),
});

export class ChatHandler {
  constructor(private aiService: OpenAIService) {}

  async handleMessage(ctx: Context): Promise<void> {
    try {
      // Walidacja kontekstu wiadomości
      const validatedCtx = MessageContextSchema.safeParse(ctx);
      
      if (!validatedCtx.success) {
        console.error('Validation error:', validatedCtx.error.format());
        throw new Error('Invalid message context');
      }

      const { message: { text }, chat: { id: chatId } } = validatedCtx.data;

      await ctx.api.sendChatAction(chatId, "typing");
      const response = await this.aiService.generateResponse(text);
      await ctx.reply(response);
    } catch (error) {
      console.error('Error in handleMessage:', error);
      if (ctx.chat?.id) {
        await ctx.reply("Przepraszam, wystąpił błąd podczas przetwarzania twojej wiadomości.");
      }
    }
  }
} 