import { Context } from "grammy";
import { OpenAIService } from "../services/ai/OpenAIService";
import { 
  DocumentMessageSchema, 
  ImageMessageSchema, 
  VoiceMessageSchema,
  TextMessageSchema 
} from "../types/chat";
import { BOT_CONFIG } from "../config/config";
import { InputFile } from "grammy";

// Constants
const ALLOWED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_VOICE_SIZE = 25 * 1024 * 1024; // 25MB - Whisper's limit

export class ChatHandler {
  constructor(private aiService: OpenAIService) {}

  async handleMessage(ctx: Context): Promise<void> {
    try {
      const validatedCtx = TextMessageSchema.safeParse(ctx);
      
      if (!validatedCtx.success) {
        console.error('Validation error:', validatedCtx.error.format());
        throw new Error('Invalid message context');
      }

      const { message: { text }, chat: { id: chatId } } = validatedCtx.data;

      await ctx.api.sendChatAction(chatId, "typing");
      const response = await this.aiService.generateResponse(text);

      try {
        // Check if response contains image generation
        const parsedResponse = JSON.parse(response);
        
        if (parsedResponse.imageUrl) {
          // Send status message
          const statusMessage = await ctx.reply(BOT_CONFIG.language === 'pl'
            ? "🎨 Generuję obraz...\n⏳ To może potrwać kilka sekund..."
            : "🎨 Generating image...\n⏳ This may take a few seconds...");

          // First send the text response if exists
          if (parsedResponse.text) {
            await ctx.reply(parsedResponse.text);
          }

          // Then send the image using InputFile
          const imageBuffer = parsedResponse.imageUrl instanceof Buffer 
            ? parsedResponse.imageUrl 
            : await this.aiService.generateImage(parsedResponse.prompt);

          await ctx.replyWithPhoto(
            new InputFile(imageBuffer, 'generated-image.png'),
            {
              caption: BOT_CONFIG.language === 'pl'
                ? `🎨 Wygenerowany obraz dla:\n"${parsedResponse.prompt}"`
                : `🎨 Generated image for:\n"${parsedResponse.prompt}"`
            }
          );

          // Delete status message
          await ctx.api.deleteMessage(chatId, statusMessage.message_id);
          return;
        }
        
        // If we got here, it means the response was JSON but not an image
        await ctx.reply(parsedResponse.text || response);
        
      } catch (e) {
        // If response is not JSON, it's just a text response
        await ctx.reply(response);
      }
    } catch (error) {
      console.error('Error in handleMessage:', error);
      if (ctx.chat?.id) {
        await ctx.reply(BOT_CONFIG.language === 'pl'
          ? "Przepraszam, wystąpił błąd podczas przetwarzania wiadomości. Spróbuj ponownie."
          : "Sorry, there was an error processing your message. Please try again.");
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

  // Update document handler
  async handleDocumentMessage(ctx: Context): Promise<void> {
    try {
      const validatedCtx = DocumentMessageSchema.safeParse(ctx);
      
      if (!validatedCtx.success || !validatedCtx.data.message.document) {
        return;
      }

      const { message: { document, caption }, chat: { id: chatId } } = validatedCtx.data;
      
      // Check if document is an image
      const isImage = document.mime_type?.startsWith('image/') || 
                     ALLOWED_IMAGE_FORMATS.some(format => 
                       document.file_name.toLowerCase().endsWith(`.${format}`)
                     );

      if (isImage) {
        await ctx.api.sendChatAction(chatId, "typing");
        const fileInfo = await ctx.api.getFile(document.file_id);
        const fullFileUrl = `https://api.telegram.org/file/bot${BOT_CONFIG.token}/${fileInfo.file_path}`;

        const analysis = await this.aiService.analyzeImage(fullFileUrl, caption);
        await ctx.reply(analysis);
      } else {
        // Inform user that only images are supported
        await ctx.reply(BOT_CONFIG.language === 'pl'
          ? `Przepraszam, ale obsługuję tylko pliki graficzne w formatach: ${ALLOWED_IMAGE_FORMATS.join(', ')}`
          : `Sorry, I only support image files in formats: ${ALLOWED_IMAGE_FORMATS.join(', ')}`
        );
      }
    } catch (error) {
      console.error('Document Handler Error:', error);
      if (ctx.chat?.id) {
        await ctx.reply(BOT_CONFIG.language === 'pl' 
          ? "Przepraszam, wystąpił błąd podczas przetwarzania pliku. Spróbuj wysłać jako zdjęcie."
          : "Sorry, there was an error processing the file. Try sending it as a photo.");
      }
    }
  }

  async handleVoiceMessage(ctx: Context): Promise<void> {
    try {
      const validatedCtx = VoiceMessageSchema.safeParse(ctx);
      
      if (!validatedCtx.success || !validatedCtx.data.message.voice) {
        console.error('Voice message validation failed:', validatedCtx.error?.format());
        return;
      }

      const { message: { voice }, chat: { id: chatId } } = validatedCtx.data;

      // Check file size (25MB limit for Whisper API)
      if (voice.file_size && voice.file_size > MAX_VOICE_SIZE) {
        await ctx.reply(BOT_CONFIG.language === 'pl'
          ? "Przepraszam, ale plik głosowy jest zbyt duży. Maksymalny rozmiar to 25MB."
          : "Sorry, but the voice file is too large. Maximum size is 25MB.");
        return;
      }

      // Initial status message
      const statusMessage = await ctx.reply(BOT_CONFIG.language === 'pl'
        ? "🎤 Przetwarzam wiadomość głosową...\n⏳ Pobieranie pliku..."
        : "🎤 Processing voice message...\n⏳ Downloading file...");

      const fileInfo = await ctx.api.getFile(voice.file_id);
      if (!fileInfo.file_path) {
        throw new Error('Could not get file path');
      }

      const fullFileUrl = `https://api.telegram.org/file/bot${BOT_CONFIG.token}/${fileInfo.file_path}`;

      // Update status - converting
      await ctx.api.editMessageText(
        chatId,
        statusMessage.message_id,
        BOT_CONFIG.language === 'pl'
          ? "🎤 Przetwarzam wiadomość głosową...\n✅ Plik pobrany\n⏳ Konwertuję audio..."
          : "🎤 Processing voice message...\n✅ File downloaded\n⏳ Converting audio..."
      );

      // Get transcription with progress updates
      const { text: transcription, language: detectedLanguage } = await this.aiService.transcribeAudio(
        fullFileUrl, 
        async (status) => {
          await ctx.api.editMessageText(
            chatId,
            statusMessage.message_id,
            BOT_CONFIG.language === 'pl'
              ? `🎤 Przetwarzam wiadomość głosową...\n✅ Plik pobrany\n✅ Audio przekonwertowane\n⏳ ${status}`
              : `🎤 Processing voice message...\n✅ File downloaded\n✅ Audio converted\n⏳ ${status}`
          );
        }
      );

      // Update status - generating response
      await ctx.api.editMessageText(
        chatId,
        statusMessage.message_id,
        detectedLanguage === 'pl'
          ? "🎤 Przetwarzam wiadomość głosową...\n✅ Plik pobrany\n✅ Audio przekonwertowane\n✅ Transkrypcja gotowa\n⏳ Generuję odpowiedź..."
          : "🎤 Processing voice message...\n✅ File downloaded\n✅ Audio converted\n✅ Transcription ready\n⏳ Generating response..."
      );
      
      // Generate response based on transcription and detected language
      const response = await this.aiService.generateResponse(transcription, detectedLanguage);
      
      // Delete status message and send final response
      await ctx.api.deleteMessage(chatId, statusMessage.message_id);
      
      // Send both transcription and response in detected language
      await ctx.reply(detectedLanguage === 'pl'
        ? `🎤 Transkrypcja: ${transcription}\n\n🤖 Odpowiedź: ${response}`
        : `🎤 Transcription: ${transcription}\n\n🤖 Response: ${response}`);

    } catch (error) {
      console.error('Voice Handler Error:', error);
      if (ctx.chat?.id) {
        await ctx.reply(BOT_CONFIG.language === 'pl'
          ? "Przepraszam, wystąpił błąd podczas przetwarzania wiadomości głosowej."
          : "Sorry, there was an error processing the voice message.");
      }
    }
  }

  async handleImageGeneration(ctx: Context): Promise<void> {
    try {
      const validatedCtx = TextMessageSchema.safeParse(ctx);
      
      if (!validatedCtx.success) {
        throw new Error('Invalid message context');
      }

      const { message: { text }, chat: { id: chatId } } = validatedCtx.data;
      const prompt = text.replace(/^\/(?:generate|img)\s+/, '').trim();

      if (!prompt) {
        await ctx.reply(BOT_CONFIG.language === 'pl'
          ? "Proszę podaj opis obrazu, który chcesz wygenerować."
          : "Please provide a description of the image you want to generate.");
        return;
      }

      const statusMessage = await ctx.reply(BOT_CONFIG.language === 'pl'
        ? "🎨 Generuję obraz...\n⏳ To może potrwać kilka sekund..."
        : "🎨 Generating image...\n⏳ This may take a few seconds...");

      const imageBuffer = await this.aiService.generateImage(prompt);

      // Poprawione wysyłanie obrazu
      await ctx.replyWithPhoto(
        new InputFile(imageBuffer, 'generated-image.png'),
        {
          caption: BOT_CONFIG.language === 'pl'
            ? `🎨 Wygenerowany obraz dla:\n"${prompt}"`
            : `🎨 Generated image for:\n"${prompt}"`
        }
      );

      await ctx.api.deleteMessage(chatId, statusMessage.message_id);

    } catch (error) {
      console.error('Image Generation Error:', error);
      await ctx.reply(BOT_CONFIG.language === 'pl'
        ? "Przepraszam, wystąpił błąd podczas generowania obrazu. Spróbuj ponownie z innym opisem."
        : "Sorry, there was an error generating the image. Please try again with a different description.");
    }
  }
} 