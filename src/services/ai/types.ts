export interface AIModelConfig {
  modelName: string;
  temperature: number;
  maxTokens: number;
}

export interface AIResponse {
  content: string;
  tokens: number;
}

export interface AIServiceInterface {
  generateResponse(prompt: string, context?: string): Promise<AIResponse>;
} 