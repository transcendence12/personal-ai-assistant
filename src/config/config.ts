import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const ConfigSchema = z.object({
    token: z.string().min(1),
    language: z.enum(['pl', 'en']).default('pl'),
});

// Bot configuration
export const BOT_CONFIG = ConfigSchema.parse({
    token: process.env.TELEGRAM_BOT_TOKEN,
    language: (process.env.BOT_LANGUAGE || 'pl') as 'pl' | 'en',
});

// OpenAI configuration
export const OPENAI_CONFIG = {
    apiKey: process.env.OPENAI_API_KEY || '',
};

// Server configuration
export const SERVER_CONFIG = {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
};

// Teksty dla różnych języków
export const MESSAGES = {
    pl: {
        start: "👋 Cześć! Jestem Twoim asystentem w świecie freelancingu i programowania. " +
              "Pomogę Ci w rozwoju kariery, kodowaniu i biznesie. W czym mogę Ci pomóc?",
        help: "🔍 Mogę Ci pomóc w:\n" +
              "- Rozwoju kariery freelancera\n" +
              "- Pisaniu lepszego kodu\n" +
              "- Komunikacji z klientami\n" +
              "- Tworzeniu portfolio\n" +
              "- Szukaniu zleceń\n" +
              "- Najlepszych praktykach programowania\n\n" +
              "Po prostu napisz do mnie, a postaram się pomóc!"
    },
    en: {
        start: "👋 Hi! I'm your assistant in the world of freelancing and programming. " +
              "I'll help you with career development, coding, and business. How can I help you?",
        help: "🔍 I can help you with:\n" +
              "- Freelance career development\n" +
              "- Writing better code\n" +
              "- Client communication\n" +
              "- Portfolio building\n" +
              "- Finding projects\n" +
              "- Software development best practices\n\n" +
              "Just write to me and I'll try to help!"
    }
};

// Validate required environment variables
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'OPENAI_API_KEY'];

requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
});
