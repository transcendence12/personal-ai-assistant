import { Message } from '../../types/chat';

interface HistoryConfig {
  maxMessages: number;
}

export class MessageHistoryService {
  // Tablica przechowująca wiadomości w pamięci
  private messages: Message[] = [];
  
  // Konfiguracja określająca maksymalną liczbę wiadomości
  private config: HistoryConfig;

  constructor(config: HistoryConfig) {
    this.config = config;
  }

  addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    if (role === 'system') {
      // System prompt zawsze na początku
      this.messages = [{ role, content }, ...this.messages.filter(m => m.role !== 'system')];
    } else {
      // Dodaj nową wiadomość (zarówno user jak i assistant)
      this.messages.push({ role, content });
      
      // Zarządzanie limitem wiadomości
      const nonSystem = this.messages.filter(m => m.role !== 'system');
      if (nonSystem.length > this.config.maxMessages) {
        const system = this.messages.find(m => m.role === 'system');
        this.messages = system ? [system, ...nonSystem.slice(-this.config.maxMessages)] : nonSystem.slice(-this.config.maxMessages);
      }
    }
  }

  getMessages(): Message[] {
    return this.messages;
  }

  clearHistory(): void {
    this.messages = this.messages.filter(m => m.role === 'system');
  }

  setMaxMessages(max: number): void {
    this.config.maxMessages = max;
    // Trim history if needed after changing max
    const systemMessages = this.messages.filter(m => m.role === 'system');
    const nonSystemMessages = this.messages.filter(m => m.role !== 'system');
    this.messages = [
      ...systemMessages,
      ...nonSystemMessages.slice(-max)
    ];
  }

  getConfig() {
    return {
      maxMessages: this.config.maxMessages
    };
  }

  summarizeConversation(): string {
    return this.messages
      .map(m => `${m.role}: ${m.content.substring(0, 50)}...`)
      .join('\n');
  }
} 