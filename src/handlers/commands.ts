import { CommandContext, Context } from "grammy";

export const handleStart = async (ctx: CommandContext<Context>): Promise<void> => {
  await ctx.reply(
    "👋 Cześć! Jestem Twoim asystentem w świecie freelancingu i programowania. " +
    "Pomogę Ci w rozwoju kariery, kodowaniu i biznesie. W czym mogę Ci pomóc?"
  );
};

export const handleHelp = async (ctx: CommandContext<Context>): Promise<void> => {
  await ctx.reply(
    "🔍 Mogę Ci pomóc w:\n" +
    "- Rozwoju kariery freelancera\n" +
    "- Pisaniu lepszego kodu\n" +
    "- Komunikacji z klientami\n" +
    "- Tworzeniu portfolio\n" +
    "- Szukaniu zleceń\n" +
    "- Najlepszych praktykach programowania\n\n" +
    "Po prostu napisz do mnie, a postaram się pomóc!"
  );
}; 