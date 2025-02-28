import axios from 'axios';
import { TavilyResponse, TavilyServiceInterface } from '../../types/tavily';
import { BOT_CONFIG } from '../../config/config';

export class TavilyService implements TavilyServiceInterface {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.tavily.com';

  constructor() {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY is not set in environment variables');
    }
    // Ensure API key has the tvly- prefix
    this.apiKey = apiKey.startsWith('tvly-') ? apiKey : `tvly-${apiKey}`;
  }

  async search(query: string): Promise<TavilyResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/search`,
        {
          query: `${query} after:2023-12`,  // Force search for content after GPT's cutoff date
          search_depth: 'advanced',
          include_images: false,
          include_answer: true,
          max_results: 3,
          time_range: 'month',  // Get results from the last month
          sort_by: 'date',      // Sort by date to get newest first
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      // If no results found with month range, try without date restriction
      if (response.data.results.length === 0) {
        const retryResponse = await axios.post(
          `${this.baseUrl}/search`,
          {
            query,
            search_depth: 'advanced',
            include_images: false,
            include_answer: true,
            max_results: 3,
            sort_by: 'date'
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            }
          }
        );
        return retryResponse.data;
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Tavily API Error:', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data // Add this to see more error details
        });

        switch (error.response?.status) {
          case 401:
            throw new Error(BOT_CONFIG.language === 'pl' 
              ? 'Nieprawidłowy klucz API Tavily'
              : 'Invalid Tavily API key');
          case 429:
            throw new Error(BOT_CONFIG.language === 'pl'
              ? 'Przekroczono limit zapytań do API Tavily'
              : 'Tavily API rate limit exceeded');
          case 404:
            throw new Error(BOT_CONFIG.language === 'pl'
              ? 'Nieprawidłowy endpoint API Tavily'
              : 'Invalid Tavily API endpoint');
          default:
            throw new Error(BOT_CONFIG.language === 'pl'
              ? `Błąd API Tavily: ${error.message}`
              : `Tavily API error: ${error.message}`);
        }
      }

      throw error;
    }
  }
} 