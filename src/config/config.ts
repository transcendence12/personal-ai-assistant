import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const ConfigSchema = z.object({
    token: z.string().min(1),
});

// Bot configuration
export const BOT_CONFIG = ConfigSchema.parse({
    token: process.env.TELEGRAM_BOT_TOKEN,
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

// Validate required environment variables
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'OPENAI_API_KEY'];

requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
});
