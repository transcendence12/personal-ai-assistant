import { Bot, BotError, GrammyError, HttpError } from "grammy";
import { BOT_CONFIG } from "./config/config";
import { CommandHandler } from "./handlers/commands";
import { ChatHandler } from "./handlers/chat";
import { OpenAIService } from "./services/ai/OpenAIService";

async function startBot() {
  const bot = new Bot(BOT_CONFIG.token);
  const aiService = new OpenAIService();
  const commandHandler = new CommandHandler(aiService);
  const chatHandler = new ChatHandler(aiService);

  bot.command("start", (ctx) => commandHandler.handleStart(ctx));
  bot.command("help", (ctx) => commandHandler.handleHelp(ctx));
  bot.command("history", (ctx) => commandHandler.handleSetHistory(ctx));
  bot.command("temp", (ctx) => commandHandler.handleSetTemperature(ctx));
  bot.command("lang", (ctx) => commandHandler.handleSetLanguage(ctx));

  bot.on("message:text", (ctx) => chatHandler.handleMessage(ctx));
  bot.on("message:photo", (ctx) => chatHandler.handleImageMessage(ctx));
  bot.on("message:document", (ctx) => chatHandler.handleDocumentMessage(ctx));

  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
      console.error("Could not contact Telegram:", e);
    } else {
      console.error("Unknown error:", e);
    }
  });

  console.log("🤖 Freelance Mentor Bot is starting...");
  await bot.start();
}

startBot().catch(console.error);