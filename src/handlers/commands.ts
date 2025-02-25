import { CommandContext, Context } from "grammy";
import { BOT_CONFIG, MESSAGES } from "../config/config";

export const handleStart = async (ctx: CommandContext<Context>): Promise<void> => {
  await ctx.reply(MESSAGES[BOT_CONFIG.language].start);
};

export const handleHelp = async (ctx: CommandContext<Context>): Promise<void> => {
  await ctx.reply(MESSAGES[BOT_CONFIG.language].help);
}; 