import { CommandContext, Context } from "grammy";

export const handleStart = async (ctx: CommandContext<Context>): Promise<void> => {
  await ctx.reply("👋 Hello! I'm your personal AI assistant. How can I help you today?");
};

export const handleHelp = async (ctx: CommandContext<Context>): Promise<void> => {
  const helpText = `
Here are the available commands:
/start - Start the bot
/help - Show this help message
/chat - Start a chat with AI assistant
/image - Generate an image using DALL·E
  `;
  await ctx.reply(helpText);
}; 