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

// Add document schema
export const DocumentMessageSchema = z.object({
  message: z.object({
    document: z.object({
      file_id: z.string(),
      file_name: z.string(),
      mime_type: z.string().optional(),
    }),
    caption: z.string().optional(),
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

  async handleImageMessage(ctx: Context): Promise<void> {
    try {
      const validatedCtx = ImageMessageSchema.safeParse(ctx);
      
      if (!validatedCtx.success || !validatedCtx.data.message.photo) {
        throw new Error('Invalid image message');
      }

      const { message: { photo, caption }, chat: { id: chatId } } = validatedCtx.data;
      
      // Debug log: Image details
      console.log('Image Details:', {
        photoCount: photo.length,
        sizes: photo.map(p => `${p.width}x${p.height}`),
        caption: caption || 'No caption'
      });
      
      const largestPhoto = photo[photo.length - 1];
      await ctx.api.sendChatAction(chatId, "typing");

      const fileInfo = await ctx.api.getFile(largestPhoto.file_id);
      
      // Debug log: File info
      console.log('File Info:', {
        fileId: largestPhoto.file_id,
        filePath: fileInfo.file_path,
        fileFormat: fileInfo.file_path?.split('.').pop()?.toLowerCase(),
        fileSize: largestPhoto.file_size
      });

      const fileFormat = fileInfo.file_path?.split('.').pop()?.toLowerCase();
      if (!fileFormat || !ALLOWED_IMAGE_FORMATS.includes(fileFormat)) {
        console.log('Invalid format:', fileFormat);
        await ctx.reply(BOT_CONFIG.language === 'pl'
          ? `Przepraszam, ale akceptuję tylko obrazy w formatach: ${ALLOWED_IMAGE_FORMATS.join(', ')}`
          : `Sorry, I only accept images in formats: ${ALLOWED_IMAGE_FORMATS.join(', ')}`
        );
        return;
      }

      const fullFileUrl = `https://api.telegram.org/file/bot${BOT_CONFIG.token}/${fileInfo.file_path}`;
      console.log('Full URL:', fullFileUrl);

      try {
        const analysis = await this.aiService.analyzeImage(fullFileUrl, caption);
        
        // Debug log: Analysis result
        console.log('Analysis Result:', {
          length: analysis.length,
          excerpt: analysis.substring(0, 100),
          hasError: analysis.toLowerCase().includes('error') || analysis.toLowerCase().includes('cannot recognize')
        });
        
        if (!analysis || analysis.toLowerCase().includes('cannot recognize') || analysis.toLowerCase().includes('error')) {
          throw new Error('Image content not recognizable');
        }
        
        await ctx.reply(analysis);
      } catch (error) {
        console.error('Image Analysis Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          url: fullFileUrl,
          imageSize: `${largestPhoto.width}x${largestPhoto.height}`
        });

        const errorMessage = BOT_CONFIG.language === 'pl'
          ? "Przepraszam, ale nie mogę rozpoznać zawartości tego obrazu. Czy możesz przesłać inny obraz lub upewnić się, że obraz jest wyraźny?"
          : "Sorry, I cannot recognize the content of this image. Could you send another image or make sure the image is clear?";
        
        await ctx.reply(errorMessage);
      }
    } catch (error) {
      console.error('Handler Error:', error);
      if (ctx.chat?.id) {
        await ctx.reply(BOT_CONFIG.language === 'pl' 
          ? "Przepraszam, wystąpił błąd podczas przetwarzania obrazu. Spróbuj ponownie z innym obrazem."
          : "Sorry, there was an error processing the image. Please try again with a different image.");
      }
    }
  }

  // Add document handler
  async handleDocumentMessage(ctx: Context): Promise<void> {
    try {
      const validatedCtx = DocumentMessageSchema.safeParse(ctx);
      
      if (!validatedCtx.success || !validatedCtx.data.message.document) {
        return; // Silently ignore non-document messages
      }

      const { message: { document, caption }, chat: { id: chatId } } = validatedCtx.data;
      
      // Check if document is an image by mime type or file extension
      const isImage = document.mime_type?.startsWith('image/') || 
                     ALLOWED_IMAGE_FORMATS.some(format => 
                       document.file_name.toLowerCase().endsWith(`.${format}`)
                     );

      if (!isImage) {
        return; // Silently ignore non-image documents
      }

      await ctx.api.sendChatAction(chatId, "typing");

      const fileInfo = await ctx.api.getFile(document.file_id);
      const fullFileUrl = `https://api.telegram.org/file/bot${BOT_CONFIG.token}/${fileInfo.file_path}`;

      const analysis = await this.aiService.analyzeImage(fullFileUrl, caption);
      await ctx.reply(analysis);

    } catch (error) {
      console.error('Document Handler Error:', error);
      if (ctx.chat?.id) {
        await ctx.reply(BOT_CONFIG.language === 'pl' 
          ? "Przepraszam, wystąpił błąd podczas przetwarzania pliku. Spróbuj wysłać jako zdjęcie."
          : "Sorry, there was an error processing the file. Try sending it as a photo.");
      }
    }
  }
} 