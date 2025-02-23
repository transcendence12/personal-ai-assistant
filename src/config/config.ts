import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Bot configuration
export const BOT_CONFIG = {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    options: {
        // Add any bot options here
        polling: true
    }
};

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
