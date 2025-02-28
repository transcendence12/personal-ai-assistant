export interface TavilySearchResult {
  url: string;
  content: string;
  score: number;
  title?: string;
}

export interface TavilyResponse {
  query: string;
  results: TavilySearchResult[];
  search_depth: string;
  search_id: string;
}

export interface TavilyServiceInterface {
  search(query: string): Promise<TavilyResponse>;
} 