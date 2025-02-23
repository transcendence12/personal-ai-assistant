import { AIModelConfig, AIServiceInterface, AIResponse } from './types';

export abstract class BaseAIService implements AIServiceInterface {
  protected config: AIModelConfig;

  constructor(config: AIModelConfig) {
    this.config = config;
  }

  abstract generateResponse(prompt: string, context?: string): Promise<AIResponse>;
} 