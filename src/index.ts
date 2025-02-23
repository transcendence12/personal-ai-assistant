import { Bot, BotError, GrammyError, HttpError } from "grammy";
import { BOT_CONFIG } from "./config/config";
import { handleStart, handleHelp } from "./handlers/commands";
import { ChatHandler } from "./handlers/chat";

async function startBot() {
  const bot = new Bot(BOT_CONFIG.token);
  const chatHandler = await ChatHandler.initialize();

  bot.command("start", handleStart);
  bot.command("help", handleHelp);

  bot.on("message:text", async (ctx) => {
    await chatHandler.handleMessage(ctx);
  });

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

  console.log("🤖 Bot is starting...");
  await bot.start();
}

startBot().catch(console.error);