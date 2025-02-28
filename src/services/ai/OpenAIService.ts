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
import { TavilyService } from './TavilyService';

interface WhisperResponse {
  text: string;
  language: string;
}

export class OpenAIService {
  private client: OpenAI;
  private history: MessageHistoryService;
  private config;
  private tavilyService: TavilyService;
  private readonly SYSTEM_PROMPT = `You are an AI assistant named Harry. You must always:
1. Remember that YOU are Harry - an experienced freelance mentor. Never say you are just an AI without a name.
2. Keep your identity consistent - always introduce yourself as Harry

3. CRITICAL - Web Search Capabilities:
   - You MUST use web search for any information after your training cutoff date (December 2023)
   - You CANNOT provide information about events, versions, or updates after December 2023 without web search
   - When asked about current or recent information, ALWAYS acknowledge your knowledge cutoff date and use web search
   - NEVER rely on your built-in knowledge for anything after December 2023

4. CRITICAL - Image Capabilities:
   - You CAN and MUST analyze images when they are shared
   - You CAN and MUST generate images when requested
   - For image analysis:
     * Provide detailed descriptions
     * Focus on key elements and context
     * Maintain professional tone
   - For image generation:
     * Create detailed prompts
     * Consider artistic style and composition
     * Follow user specifications closely

5. Response Format:
   - For web search results:
     [Brief answer based on current web search results]
     
     Sources:
     [1] [url1]
     [2] [url2]
     [3] [url3]
   - For responses from your knowledge (pre-December 2023):
     [Brief answer with note about knowledge cutoff date if relevant]
   - For regular responses (no web search):
     [Brief, direct answer without sources]
   - For image generation, format as:
     [Description of what will be generated]
     [Generated image]
   - For image analysis, format as:
     [Detailed description of the image]
     [Analysis of key elements]

6. IMPORTANT - Sources:
   - ONLY include sources when you actually perform a web search
   - NEVER fabricate or make up sources
   - NEVER include sources for responses based on your built-in knowledge
   - Sources must come from actual web search results

7. Provide expert guidance on:
   - Writing professional and maintainable code
   - Business aspects of freelancing
   - Client communication and project management
   - Portfolio development
   - Finding projects in the Polish market
   - Best practices in software development
   - Analyze images and provide detailed descriptions
   - Search the web for current information

8. You can also:
   - Generate images using DALL-E when users request visualizations
   - Process voice messages and respond to spoken questions
   - Understand both Polish and English
   - Maintain context between messages

9. When to generate images:
   - When users explicitly ask for images or visualizations
   - When a visual explanation would be more helpful
   - When users use phrases like "show me", "draw", "generate", "create image"
   - When explaining visual concepts or designs
   - When users send /generate or /img commands

10. IMPORTANT - When to search the web (you MUST use web search for these cases):
    - ANY information about events, versions, or updates after December 2023
    - When users ask about "current", "latest", "newest", or "recent" information
    - When users explicitly request information from a specific date after December 2023
    - When users ask about changes or updates that might have happened after December 2023
    DO NOT rely on your built-in knowledge for any information after December 2023.

11. Keep responses:
    - Practical and actionable
    - Professional but friendly
    - Concise but informative
    - Include image generation when appropriate
    - Include web search results with sources when relevant
    - Always mention sources when providing information from web search`;

  constructor() {
    ffmpeg.setFfmpegPath(ffmpegPath.path);
    
    const config = ChatConfigSchema.parse({
      model: 'gpt-4',
      temperature: 0.3,
      maxMessages: 3,
      maxTokens: 300,
    });

    const apiKey = z.string().min(1).parse(process.env.OPENAI_API_KEY);

    this.client = new OpenAI({ apiKey });
    this.history = new MessageHistoryService({ maxMessages: config.maxMessages });
    this.config = config;
    this.tavilyService = new TavilyService();
    
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

  private isConversationSummaryRequest(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return (
      lowerMessage.includes('summarize our conversation') ||
      lowerMessage.includes('podsumuj naszą konwersację') ||
      lowerMessage.includes('podsumuj rozmowę') ||
      lowerMessage.includes('what did we discuss') ||
      lowerMessage.includes('o czym rozmawialiśmy') ||
      lowerMessage.includes('latest 3 topics') ||
      lowerMessage.includes('ostatnie 3 tematy') ||
      lowerMessage.includes('what we talked about') ||
      lowerMessage.includes('conversation history')
    );
  }

  private shouldForceWebSearch(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    
    // Don't search web for conversation summaries and similar requests
    if (
      lowerMessage.includes('summarize our conversation') ||
      lowerMessage.includes('podsumuj naszą konwersację') ||
      lowerMessage.includes('podsumuj rozmowę') ||
      lowerMessage.includes('what did we discuss') ||
      lowerMessage.includes('o czym rozmawialiśmy') ||
      lowerMessage.includes('latest 3 topics') ||
      lowerMessage.includes('ostatnie 3 tematy') ||
      lowerMessage.includes('what we talked about') ||
      lowerMessage.includes('conversation history')
    ) {
      return false;
    }

    // Only search web for specific queries about external information
    return (
      lowerMessage.includes('najnowsz') || // Polish: newest/latest
      lowerMessage.includes('ostatni') ||   // Polish: last/latest
      lowerMessage.includes('aktualni') ||  // Polish: current
      lowerMessage.includes('latest') ||
      lowerMessage.includes('newest') ||
      lowerMessage.includes('current version') ||
      (lowerMessage.includes('link') && !lowerMessage.includes('conversation')) ||
      (lowerMessage.includes('source') && !lowerMessage.includes('conversation')) ||
      (lowerMessage.includes('źródł') && !lowerMessage.includes('rozmow'))  // Polish: source, conversation
    );
  }

  async generateResponse(userMessage: string, detectedLanguage?: string): Promise<string> {
    try {
      const messageLanguage = detectedLanguage || BOT_CONFIG.language;
      const isConversationSummary = this.isConversationSummaryRequest(userMessage);
      const forceWebSearch = !isConversationSummary && this.shouldForceWebSearch(userMessage);
      
      this.history.addMessage('user', userMessage);
      
      const tools = [
        {
          type: "function" as const,
          function: {
            name: "search_web",
            description: "Search the web for real-time information. REQUIRED when user asks about: current events, latest versions, recent updates, specific versions, or anything that might be outdated in your knowledge.",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query to find relevant information"
                }
              },
              required: ["query"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "generate_image",
            description: "Generate an image using DALL-E when user wants to see a visual representation or explicitly asks for an image",
            parameters: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "Detailed description of the image to generate, should be clear and specific"
                }
              },
              required: ["prompt"]
            }
          }
        }
      ];

      // For conversation summaries, use a different system message
      if (isConversationSummary) {
        const summaryCompletion = await this.client.chat.completions.create({
          messages: [
            ...this.history.getMessages(),
            {
              role: 'system',
              content: messageLanguage === 'pl'
                ? 'Udziel krótkiej odpowiedzi podsumowującej tylko naszą aktualną konwersację (max 2-3 zdania). Nie dodawaj żadnych źródeł ani linków.'
                : 'Provide a short summary of only our current conversation (max 2-3 sentences). Do not add any sources or links.'
            }
          ],
          model: "gpt-4-turbo-preview",
          temperature: this.config.temperature
        });

        const response = summaryCompletion.choices[0].message.content || '';
        this.history.addMessage('assistant', response);
        return response;
      }

      const completion = await this.client.chat.completions.create({
        messages: this.history.getMessages(),
        model: "gpt-4-turbo-preview",
        temperature: this.config.temperature,
        tools,
        tool_choice: forceWebSearch ? { type: "function", function: { name: "search_web" } } : "auto"
      });

      const response = completion.choices[0].message;
      
      // Check if there are any tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        const toolCall = response.tool_calls[0];
        
        if (toolCall.function.name === "search_web") {
          const { query } = JSON.parse(toolCall.function.arguments);
          const searchResults = await this.tavilyService.search(query);

          // Sort results by score and prepare summary with sources
          const topResults = searchResults.results
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

          // Prepare content and sources separately
          const contentSummary = topResults
            .map(r => r.content)
            .join('\n\n');

          const sources = topResults
            .map((r, i) => `[${i + 1}] ${r.url}`)
            .join('\n');

          this.history.addMessage('system', `Web search results:\n${contentSummary}`);

          // Generate a new response with the search results
          const followUpCompletion = await this.client.chat.completions.create({
            messages: [
              ...this.history.getMessages(),
              {
                role: 'system',
                content: messageLanguage === 'pl'
                  ? 'Udziel krótkiej i zwięzłej odpowiedzi na podstawie wyników wyszukiwania (max 2-3 zdania). Nie cytuj źródeł w tekście - zostaną dodane automatycznie poniżej.'
                  : 'Provide a short and concise answer based on the search results (max 2-3 sentences). Do not cite sources in the text - they will be added automatically below.'
              }
            ],
            model: "gpt-4-turbo-preview",
            temperature: this.config.temperature
          });

          const finalResponse = followUpCompletion.choices[0].message.content || '';
          
          // Combine response with sources
          const formattedResponse = messageLanguage === 'pl'
            ? `${finalResponse}\n\nŹródła:\n${sources}`
            : `${finalResponse}\n\nSources:\n${sources}`;

          this.history.addMessage('assistant', formattedResponse);
          return formattedResponse;
        }

        if (toolCall.function.name === "generate_image") {
          const { prompt } = JSON.parse(toolCall.function.arguments);
          const imageUrl = await this.generateImage(prompt);
          
          this.history.addMessage('assistant', response.content || '');
          
          return JSON.stringify({
            text: response.content,
            imageUrl,
            prompt
          });
        }
      }

      // If we should force web search but no tool call was made, make one
      if (forceWebSearch) {
        return this.generateResponse(userMessage, detectedLanguage); // Retry with forced web search
      }

      this.history.addMessage('assistant', response.content || '');
      return response.content || '';
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

  async generateImage(prompt: string): Promise<Buffer> {
    try {
      // Generowanie obrazu
      const response = await this.client.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url",
      });

      if (!response.data[0]?.url) {
        throw new Error('No image URL in response');
      }

      // Pobieranie obrazu z URL
      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let i = 0; i < maxRetries; i++) {
        try {
          const imageResponse = await axios.get(response.data[0].url, {
            responseType: 'arraybuffer',
            timeout: 10000, // 10 sekund timeout
          });
          
          return Buffer.from(imageResponse.data);
        } catch (error) {
          console.error(`Attempt ${i + 1} failed:`, error);
          lastError = error as Error;
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
          }
        }
      }

      throw lastError || new Error('Failed to download image');
    } catch (error) {
      console.error('Image Generation Error:', error);
      throw this.handleOpenAIError(error);
    }
  }
} 