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

// Tavily configuration
export const TAVILY_CONFIG = {
    apiKey: process.env.TAVILY_API_KEY || '',
};

// Server configuration
export const SERVER_CONFIG = {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
};

// Teksty dla różnych języków
export const MESSAGES = {
    pl: {
        start: "👋 Cześć! Jestem Harrym, Twoim asystentem w świecie freelancingu i programowania. " +
              "Wpisz /help aby zobaczyć dostępne komendy.",
        help: "🔍 Dostępne komendy:\n" +
              "/help - wyświetla tę pomoc\n" +
              "/search <fraza> - wyszukuje aktualne informacje w internecie\n" +
              "/generate <opis> - generuje nowy obraz na podstawie opisu\n" +
              "/analyze <opis> - analizuje przesłany obraz (możesz dodać opis)\n" +
              "/history <liczba> - ustawia ilość zapamiętanych wiadomości (np. /history 5)\n" +
              "/temp <0.0-2.0> - ustawia kreatywność odpowiedzi (np. /temp 0.7)\n" +
              "/lang <pl|en> - zmienia język bota\n\n" +
              "Mogę Ci pomóc w:\n" +
              "- Rozwoju kariery freelancera\n" +
              "- Pisaniu lepszego kodu\n" +
              "- Komunikacji z klientami\n" +
              "- Tworzeniu portfolio\n" +
              "- Szukaniu zleceń\n" +
              "- Najlepszych praktykach programowania\n" +
              "- Wyszukiwaniu aktualnych informacji w internecie",
        config: {
            title: "Aktualna konfiguracja",
            language: "Język",
            history: "Historia",
            temperature: "Temperatura",
            messages: "wiadomości"
        }
    },
    en: {
        start: "👋 Hi! I'm Harry, your assistant in freelancing and programming. " +
              "Type /help to see available commands.",
        help: "🔍 Available commands:\n" +
              "/help - shows this help\n" +
              "/search <query> - searches for current information on the web\n" +
              "/generate <description> - generates a new image from description\n" +
              "/analyze <description> - analyzes uploaded image (description optional)\n" +
              "/history <number> - sets number of remembered messages (e.g. /history 5)\n" +
              "/temp <0.0-2.0> - sets response creativity (e.g. /temp 0.7)\n" +
              "/lang <pl|en> - changes bot language\n\n" +
              "I can help you with:\n" +
              "- Freelance career development\n" +
              "- Writing better code\n" +
              "- Client communication\n" +
              "- Portfolio building\n" +
              "- Finding projects\n" +
              "- Software development best practices\n" +
              "- Searching for current information on the web",
        config: {
            title: "Current configuration",
            language: "Language",
            history: "History",
            temperature: "Temperature",
            messages: "messages"
        }
    }
};

// Validate required environment variables
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'OPENAI_API_KEY', 'TAVILY_API_KEY'];

requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
});
