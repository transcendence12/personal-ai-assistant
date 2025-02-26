import { Context } from "grammy";
import { OpenAIService } from "../services/ai/OpenAIService";
import { z } from "zod";
import { BOT_CONFIG } from "../config/config";

const MessageContextSchema = z.object({
  message: z.object({
    text: z.string(),
  }),
  chat: z.object({
    id: z.number(),
  }),
});

const ImageMessageSchema = z.object({
  message: z.object({
    photo: z.array(z.object({
      file_id: z.string(),
      file_unique_id: z.string(),
      width: z.number(),
      height: z.number(),
      file_size: z.number().optional(),
    })).optional(),
    caption: z.string().optional(),
  }),
  chat: z.object({
    id: z.number(),
  }),
});

// List of allowed image formats
const ALLOWED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];

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

  async handleImageMessage(ctx: Context): Promise<void> {
    try {
      const validatedCtx = ImageMessageSchema.safeParse(ctx);
      
      if (!validatedCtx.success || !validatedCtx.data.message.photo) {
        throw new Error('Invalid image message');
      }

      const { message: { photo, caption }, chat: { id: chatId } } = validatedCtx.data;
      
      // Pobierz największą dostępną wersję zdjęcia
      const largestPhoto = photo[photo.length - 1];
      
      await ctx.api.sendChatAction(chatId, "typing");

      // Pobierz informacje o pliku
      const fileInfo = await ctx.api.getFile(largestPhoto.file_id);
      
      // Sprawdź format pliku
      const fileFormat = fileInfo.file_path?.split('.').pop()?.toLowerCase();
      if (!fileFormat || !ALLOWED_IMAGE_FORMATS.includes(fileFormat)) {
        await ctx.reply(BOT_CONFIG.language === 'pl'
          ? `Przepraszam, ale akceptuję tylko obrazy w formatach: ${ALLOWED_IMAGE_FORMATS.join(', ')}`
          : `Sorry, I only accept images in formats: ${ALLOWED_IMAGE_FORMATS.join(', ')}`
        );
        return;
      }

      const fullFileUrl = `https://api.telegram.org/file/bot${BOT_CONFIG.token}/${fileInfo.file_path}`;

      try {
        const analysis = await this.aiService.analyzeImage(fullFileUrl, caption);
        
        // Sprawdź, czy odpowiedź nie jest pusta lub nie wskazuje na problem
        if (!analysis || analysis.toLowerCase().includes('cannot recognize') || analysis.toLowerCase().includes('error')) {
          throw new Error('Image content not recognizable');
        }
        
        await ctx.reply(analysis);
      } catch (error) {
        const errorMessage = BOT_CONFIG.language === 'pl'
          ? "Przepraszam, ale nie mogę rozpoznać zawartości tego obrazu. Czy możesz przesłać inny obraz lub upewnić się, że obraz jest wyraźny?"
          : "Sorry, I cannot recognize the content of this image. Could you send another image or make sure the image is clear?";
        
        await ctx.reply(errorMessage);
        console.error('Image analysis error:', error);
      }

    } catch (error) {
      console.error('Error in handleImageMessage:', error);
      if (ctx.chat?.id) {
        await ctx.reply(BOT_CONFIG.language === 'pl' 
          ? "Przepraszam, wystąpił błąd podczas przetwarzania obrazu. Spróbuj ponownie z innym obrazem."
          : "Sorry, there was an error processing the image. Please try again with a different image.");
      }
    }
  }
} 