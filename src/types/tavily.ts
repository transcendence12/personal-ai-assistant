export interface TavilySearchResult {
  url: string;
  content: string;
  score: number;
  title?: string;
}

export interface TavilyResponse {
  results: TavilySearchResult[];
  answer?: string;
}

export interface TavilyServiceInterface {
  search(query: string): Promise<TavilyResponse>;
} 