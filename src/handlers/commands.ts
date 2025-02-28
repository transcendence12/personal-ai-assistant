import { CommandContext, Context } from "grammy";
import { BOT_CONFIG, MESSAGES } from "../config/config";
import { OpenAIService } from "../services/ai/OpenAIService";
import { InputFile } from "grammy";
import { TextMessageSchema } from "../types/chat";

export class CommandHandler {
  constructor(private aiService: OpenAIService) {}

  async handleStart(ctx: CommandContext<Context>): Promise<void> {
    await ctx.reply(MESSAGES[BOT_CONFIG.language].start);
  }

  async handleHelp(ctx: CommandContext<Context>): Promise<void> {
    const msgs = MESSAGES[BOT_CONFIG.language];
    const currentConfig = `\n\n${msgs.config.title}:\n` +
      `- ${msgs.config.language}: ${BOT_CONFIG.language}\n` +
      `- ${msgs.config.history}: ${this.aiService.getHistory().getConfig().maxMessages} ${msgs.config.messages}\n` +
      `- ${msgs.config.temperature}: ${this.aiService.getConfig().temperature}`;

    await ctx.reply(msgs.help + currentConfig);
  }

  async handleSetHistory(ctx: CommandContext<Context>): Promise<void> {
    const limit = parseInt(ctx.match);
    if (isNaN(limit) || limit < 1) {
      await ctx.reply(BOT_CONFIG.language === 'pl' 
        ? "Proszę podać prawidłową liczbę wiadomości (minimum 1)"
        : "Please provide a valid number of messages (minimum 1)");
      return;
    }
    
    this.aiService.getHistory().setMaxMessages(limit);
    await ctx.reply(BOT_CONFIG.language === 'pl'
      ? `Limit historii zmieniony na ${limit} wiadomości`
      : `History limit changed to ${limit} messages`);
  }

  async handleSetTemperature(ctx: CommandContext<Context>): Promise<void> {
    const temp = parseFloat(ctx.match);
    if (isNaN(temp) || temp < 0 || temp > 2) {
      await ctx.reply(BOT_CONFIG.language === 'pl'
        ? "Proszę podać prawidłową temperaturę (0.0 - 2.0)"
        : "Please provide a valid temperature (0.0 - 2.0)");
      return;
    }

    this.aiService.setTemperature(temp);
    await ctx.reply(BOT_CONFIG.language === 'pl'
      ? `Temperatura zmieniona na ${temp}`
      : `Temperature changed to ${temp}`);
  }

  async handleSetLanguage(ctx: CommandContext<Context>): Promise<void> {
    const lang = ctx.match as 'pl' | 'en';
    if (lang !== 'pl' && lang !== 'en') {
        await ctx.reply(BOT_CONFIG.language === 'pl' 
            ? "Dostępne języki: pl, en"
            : "Available languages: pl, en");
        return;
    }

    BOT_CONFIG.language = lang;
    
    await this.handleHelp(ctx);
  }

  async handleSearch(ctx: CommandContext<Context>): Promise<void> {
    const query = ctx.match;
    
    if (!query || query.trim().length === 0) {
      await ctx.reply(BOT_CONFIG.language === 'pl'
        ? "Proszę podać frazę do wyszukania (np. /search najnowsza wersja GPT)"
        : "Please provide a search query (e.g. /search latest GPT version)");
      return;
    }

    try {
      // Send typing indicator
      await ctx.replyWithChatAction("typing");
      
      // Force web search for this command
      const response = await this.aiService.generateResponse(query, BOT_CONFIG.language);
      await ctx.reply(response, { parse_mode: "HTML" });
    } catch (error) {
      console.error('Search error:', error);
      await ctx.reply(BOT_CONFIG.language === 'pl'
        ? "Przepraszam, wystąpił błąd podczas wyszukiwania. Spróbuj ponownie później."
        : "Sorry, there was an error during the search. Please try again later.");
    }
  }

  async handleImageGeneration(ctx: CommandContext<Context>): Promise<void> {
    try {
      const prompt = ctx.match;
      
      if (!prompt || prompt.trim().length === 0) {
        await ctx.reply(BOT_CONFIG.language === 'pl'
          ? "Proszę podać opis obrazu do wygenerowania (np. /generate zachód słońca nad morzem)"
          : "Please provide an image description (e.g. /generate sunset over the ocean)");
        return;
      }

      // Send status message
      const statusMessage = await ctx.reply(BOT_CONFIG.language === 'pl'
        ? "🎨 Generuję obraz...\n⏳ To może potrwać kilka sekund..."
        : "🎨 Generating image...\n⏳ This may take a few seconds...");

      try {
        // Generate image
        const imageBuffer = await this.aiService.generateImage(prompt);

        // Send the image
        await ctx.replyWithPhoto(
          new InputFile(imageBuffer, 'generated-image.png'),
          {
            caption: BOT_CONFIG.language === 'pl'
              ? `🎨 Wygenerowany obraz dla:\n"${prompt}"`
              : `🎨 Generated image for:\n"${prompt}"`
          }
        );

        // Delete status message
        await ctx.api.deleteMessage(ctx.chat.id, statusMessage.message_id);
      } catch (error) {
        console.error('Image Generation Error:', error);
        
        // Update status message with error
        await ctx.api.editMessageText(
          ctx.chat.id,
          statusMessage.message_id,
          BOT_CONFIG.language === 'pl'
            ? "❌ Przepraszam, wystąpił błąd podczas generowania obrazu. Spróbuj ponownie z innym opisem."
            : "❌ Sorry, there was an error generating the image. Please try again with a different description."
        );
      }
    } catch (error) {
      console.error('Handler Error:', error);
      if (ctx.chat?.id) {
        await ctx.reply(BOT_CONFIG.language === 'pl'
          ? "Przepraszam, wystąpił błąd podczas przetwarzania komendy. Spróbuj ponownie."
          : "Sorry, there was an error processing your command. Please try again.");
      }
    }
  }

  async handleImageAnalysis(ctx: CommandContext<Context>): Promise<void> {
    try {
      await ctx.reply(BOT_CONFIG.language === 'pl'
        ? "Aby przeanalizować obraz, wyślij go jako zdjęcie lub plik. Możesz dodać opis w podpisie."
        : "To analyze an image, send it as a photo or file. You can add a description in the caption.");
    } catch (error) {
      console.error('Handler Error:', error);
      if (ctx.chat?.id) {
        await ctx.reply(BOT_CONFIG.language === 'pl'
          ? "Przepraszam, wystąpił błąd podczas przetwarzania komendy. Spróbuj ponownie."
          : "Sorry, there was an error processing your command. Please try again.");
      }
    }
  }
} 