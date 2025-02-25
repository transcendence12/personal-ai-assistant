import { CommandContext, Context } from "grammy";
import { BOT_CONFIG, MESSAGES } from "../config/config";
import { OpenAIService } from "../services/ai/OpenAIService";

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
    
    // Po zmianie języka, wyświetl pomoc w nowym języku
    await this.handleHelp(ctx);
  }
} 