import { z } from 'zod';

export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

export const ChatConfigSchema = z.object({
  model: z.string(),
  temperature: z.number().min(0).max(2),
  maxMessages: z.number().min(1),
  maxTokens: z.number().min(1),
});

export type Message = z.infer<typeof MessageSchema>;
export type ChatConfig = z.infer<typeof ChatConfigSchema>; 