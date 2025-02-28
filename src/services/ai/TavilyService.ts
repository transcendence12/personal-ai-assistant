import { tavily } from '@tavily/core';
import { TavilyResponse, TavilyServiceInterface } from '../../types/tavily';
import { BOT_CONFIG } from '../../config/config';

export class TavilyService implements TavilyServiceInterface {
  private readonly client;

  constructor() {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY is not set in environment variables');
    }
    // Initialize Tavily client
    this.client = tavily({
      apiKey: apiKey.startsWith('tvly-') ? apiKey : `tvly-${apiKey}`
    });
  }

  async search(query: string): Promise<TavilyResponse> {
    try {
      const response = await this.client.search(query, {
        search_depth: "advanced",
        include_images: false,
        include_answer: true,
        max_results: 3,
        sort_by: "date",
        time_range: "month"
      });

      // If no results found with month range, try without time restriction
      if (!response.results || response.results.length === 0) {
        const retryResponse = await this.client.search(query, {
          search_depth: "advanced",
          include_images: false,
          include_answer: true,
          max_results: 3,
          sort_by: "date"
        });

        return {
          results: retryResponse.results || [],
          answer: retryResponse.answer
        };
      }

      return {
        results: response.results || [],
        answer: response.answer
      };
    } catch (error) {
      console.error('Tavily Search Error:', error);
      
      if (error instanceof Error) {
        switch (error.message) {
          case 'Unauthorized':
            throw new Error(BOT_CONFIG.language === 'pl' 
              ? 'Nieprawidłowy klucz API Tavily'
              : 'Invalid Tavily API key');
          case 'Too Many Requests':
            throw new Error(BOT_CONFIG.language === 'pl'
              ? 'Przekroczono limit zapytań do API Tavily'
              : 'Tavily API rate limit exceeded');
          default:
            throw new Error(BOT_CONFIG.language === 'pl'
              ? `Błąd wyszukiwania Tavily: ${error.message}`
              : `Tavily search error: ${error.message}`);
        }
      }

      throw error;
    }
  }
} 