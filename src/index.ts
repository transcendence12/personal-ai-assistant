import { Bot, BotError, GrammyError, HttpError } from "grammy";
import { BOT_CONFIG } from "./config/config";
import { handleStart, handleHelp } from "./handlers/commands";

// Create bot instance
const bot = new Bot(BOT_CONFIG.token);

// Register command handlers
bot.command("start", handleStart);
bot.command("help", handleHelp);

// Handle text messages
bot.on("message:text", async (ctx) => {
  // Here we'll add AI chat functionality later
  await ctx.reply("I received your message. AI chat functionality coming soon!");
});

// Error handling
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

// Start the bot
console.log("🤖 Bot is starting...");
bot.start();