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

export const ImageMessageSchema = z.object({
  message: z.object({
    photo: z.array(z.object({
      file_id: z.string(),
      file_unique_id: z.string(),
      width: z.number(),
      height: z.number(),
      file_size: z.number().optional(),
    })).optional(),
    caption: z.string().optional(),
  }),
  chat: z.object({
    id: z.number(),
  }),
});

export const DocumentMessageSchema = z.object({
  message: z.object({
    document: z.object({
      file_id: z.string(),
      file_name: z.string(),
      mime_type: z.string().optional(),
    }),
    caption: z.string().optional(),
  }),
  chat: z.object({
    id: z.number(),
  }),
});

export const VoiceMessageSchema = z.object({
  message: z.object({
    voice: z.object({
      file_id: z.string(),
      duration: z.number(),
      mime_type: z.string().optional().default('audio/ogg'),
      file_size: z.number().optional(),
    }),
    caption: z.string().optional(),
  }),
  chat: z.object({
    id: z.number(),
  }),
});

export const TextMessageSchema = z.object({
  message: z.object({
    text: z.string(),
  }),
  chat: z.object({
    id: z.number(),
  }),
});

export type Message = z.infer<typeof MessageSchema>;
export type ChatConfig = z.infer<typeof ChatConfigSchema>; 