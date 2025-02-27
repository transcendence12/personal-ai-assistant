import OpenAI from 'openai';
import { MessageHistoryService } from '../history/MessageHistoryService';
import { ChatConfigSchema } from '../../types/chat';
import { z } from 'zod';
import { APIError } from 'openai';
import { BOT_CONFIG } from '../../config/config';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { Readable } from 'stream';
import axios from 'axios';

interface WhisperResponse {
  text: string;
  language: string;
}

export class OpenAIService {
  private client: OpenAI;
  private history: MessageHistoryService;
  private config;
  private detectedAudioLanguage?: string;
  private readonly SYSTEM_PROMPT = `You are an AI assistant named Harry. You must always:
1. Remember that YOU are Harry - an experienced freelance mentor. Never say you are just an AI without a name.
2. Keep your identity consistent - always introduce yourself as Harry
3. Provide expert guidance on:
   - Writing professional and maintainable code
   - Business aspects of freelancing
   - Client communication and project management
   - Portfolio development
   - Finding projects in the Polish market
   - Best practices in software development
   - Analyze images and provide a detailed description of the image

4. You can also:
   - Process voice messages and respond to spoken questions
   - Understand both Polish and English voice messages (up to 25MB in size)
   - Provide accurate transcriptions of voice messages
   - Help users understand when their voice messages are too long or unclear
   - Maintain context between voice and text messages in the same conversation

5. Keep responses:
   - Practical and actionable
   - Focused on the Polish freelance market when relevant
   - Professional but friendly
   - Concise but informative
   - Consistent whether responding to text or voice messages`;

  constructor() {
    ffmpeg.setFfmpegPath(ffmpegPath.path);
    
    const config = ChatConfigSchema.parse({
      model: 'gpt-4',
      temperature: 0.3,
      maxMessages: 3, // Start with 3 messages, can be changed via command
      maxTokens: 300,
    });

    const apiKey = z.string().min(1).parse(process.env.OPENAI_API_KEY);

    this.client = new OpenAI({ apiKey });
    this.history = new MessageHistoryService({ maxMessages: config.maxMessages });
    this.config = config;
    
    // Add system prompt to history
    this.history.addMessage('system', this.SYSTEM_PROMPT);
  }

  private handleOpenAIError(error: unknown): never {
    if (error instanceof APIError) {
      console.error('OpenAI API Error:', {
        status: error.status,
        message: error.message,
        code: error.code,
        type: error.type
      });
      
      switch (error.status) {
        case 401:
          throw new Error('Nieprawidłowy klucz API OpenAI');
        case 429:
          throw new Error('Przekroczono limit zapytań do API');
        case 500:
          throw new Error('Błąd serwera OpenAI - spróbuj ponownie później');
        default:
          throw new Error(`Błąd API OpenAI: ${error.message}`);
      }
    }

    if (axios.isAxiosError(error)) {
      console.error('Network Error:', {
        message: error.message,
        code: error.code,
        status: error.response?.status
      });
      
      if (error.code === 'ECONNRESET') {
        throw new Error(BOT_CONFIG.language === 'pl'
          ? 'Błąd połączenia podczas pobierania pliku. Spróbuj ponownie.'
          : 'Connection error while downloading file. Please try again.');
      }
      
      throw new Error(BOT_CONFIG.language === 'pl'
        ? 'Błąd sieci podczas przetwarzania pliku audio.'
        : 'Network error while processing audio file.');
    }

    if (error instanceof z.ZodError) {
      console.error('Validation Error:', error.format());
      throw new Error('Błąd walidacji danych');
    }

    console.error('Unexpected Error:', error);
    throw new Error('Wystąpił nieoczekiwany błąd');
  }

  async generateResponse(userMessage: string, detectedLanguage?: string): Promise<string> {
    try {
      const messageLanguage = detectedLanguage || BOT_CONFIG.language;
      
      // Add language instruction to system message
      const languageInstruction = messageLanguage === 'pl' 
        ? "Musisz odpowiadać wyłącznie po polsku na wszystkie wiadomości." 
        : "You must respond only in English to all messages.";
      
      // Add temporary language instruction at the beginning
      const systemMessages = this.history.getMessages().filter(m => m.role === 'system');
      const updatedSystemPrompt = `${this.SYSTEM_PROMPT}\n\n${languageInstruction}`;
      
      // Update system messages with language instruction
      systemMessages.forEach(msg => {
        this.history.removeMessage(msg.content);
      });
      this.history.addMessage('system', updatedSystemPrompt);
      
      // Add user message
      this.history.addMessage('user', userMessage);
      
      const messages = this.history.getMessages();
      
      const completion = await this.client.chat.completions.create({
        messages,
        model: this.config.model,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const responseContent = completion.choices[0].message.content || '';
      this.history.addMessage('assistant', responseContent);
      
      // Restore original system prompt
      systemMessages.forEach(msg => {
        this.history.removeMessage(msg.content);
      });
      this.history.addMessage('system', this.SYSTEM_PROMPT);
      
      return responseContent;
    } catch (error) {
      return this.handleOpenAIError(error);
    }
  }

  setTemperature(temp: number): void {
    if (temp < 0 || temp > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }
    this.config.temperature = temp;
  }

  getHistory(): MessageHistoryService {
    return this.history;
  }

  getConfig() {
    return {
      temperature: this.config.temperature,
      model: this.config.model,
      maxTokens: this.config.maxTokens
    };
  }

  async analyzeImage(fileUrl: string, caption?: string): Promise<string> {
    try {
      const messages = [
        { role: 'system' as const, content: this.SYSTEM_PROMPT },
        { 
          role: 'user' as const, 
          content: [
            {
              type: 'image_url' as const,
              image_url: { url: fileUrl }
            },
            {
              type: 'text' as const,
              text: caption || 'Describe this image in detail, focusing on the most important elements.'
            }
          ]
        }
      ];

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-2024-04-09',
        messages,
        max_tokens: this.config.maxTokens,
      });

      const response = completion.choices[0].message.content || '';
      return response;
    } catch (error) {
      return this.handleOpenAIError(error);
    }
  }

  private async convertOggToMp3(audioBlob: Blob): Promise<Blob> {
    try {
      const readableStream = new Readable();
      const buffer = await audioBlob.arrayBuffer();
      readableStream.push(Buffer.from(buffer));
      readableStream.push(null);

      const chunks: Buffer[] = [];
      
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(readableStream)
          .inputFormat('ogg')
          .toFormat('mp3')
          .audioFrequency(16000)
          .audioChannels(1)
          .on('error', (err) => reject(err))
          .on('end', () => resolve())
          .pipe()
          .on('data', (chunk: Buffer) => chunks.push(chunk));
      });

      return new Blob([Buffer.concat(chunks)], { type: 'audio/mp3' });
    } catch (error) {
      console.error('Audio conversion error:', error);
      throw new Error('Failed to convert audio format');
    }
  }

  async transcribeAudio(fileUrl: string, onProgress?: (status: string) => Promise<void>): Promise<WhisperResponse> {
    try {
      // Add retry logic for downloading
      const maxRetries = 3;
      let retryCount = 0;
      let response;

      while (retryCount < maxRetries) {
        try {
          response = await axios.get(fileUrl, {
            responseType: 'arraybuffer',
            timeout: 10000, // 10 second timeout
          });
          break;
        } catch (error) {
          retryCount++;
          if (retryCount === maxRetries) {
            throw error;
          }
          console.log(`Retry attempt ${retryCount} for downloading audio file...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        }
      }
      
      if (!response) {
        throw new Error('Failed to download audio file after multiple attempts');
      }

      const audioData = new Blob([response.data], { type: 'audio/ogg' });
      console.log('Original audio file details:', {
        size: audioData.size,
        type: audioData.type,
      });

      if (onProgress) {
        await onProgress(BOT_CONFIG.language === 'pl' 
          ? 'Konwertuję format audio...'
          : 'Converting audio format...');
      }

      // Convert OGG to MP3
      const mp3Data = await this.convertOggToMp3(audioData);
      console.log('Converted MP3 file details:', {
        size: mp3Data.size,
        type: mp3Data.type,
      });

      if (onProgress) {
        await onProgress(BOT_CONFIG.language === 'pl'
          ? 'Przygotowuję transkrypcję...'
          : 'Preparing transcription...');
      }

      // Create a File object that OpenAI can handle
      const audioFile = new File(
        [mp3Data], 
        'audio.mp3',
        { type: 'audio/mp3' }
      );

      // Get transcription with language detection
      const transcriptionResponse = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        response_format: 'json',
        temperature: 0.2,
      });

      // Extract language from detected text
      const detectedLanguage = transcriptionResponse.text.includes('ą') || 
                             transcriptionResponse.text.includes('ę') || 
                             transcriptionResponse.text.includes('ó') || 
                             transcriptionResponse.text.includes('ł') || 
                             transcriptionResponse.text.includes('ż') || 
                             transcriptionResponse.text.includes('ź') || 
                             transcriptionResponse.text.includes('ć') || 
                             transcriptionResponse.text.includes('ń') || 
                             transcriptionResponse.text.includes('ś') 
                             ? 'pl' : 'en';

      // Return text and detected language
      return {
        text: transcriptionResponse.text,
        language: detectedLanguage
      };
    } catch (error) {
      console.error('Transcription Error:', error);
      throw this.handleOpenAIError(error);
    }
  }
} 