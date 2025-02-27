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
    // System prompt jest zawsze pierwszy i tylko jeden
    if (role === 'system') {
      // Usuń stary system prompt jeśli istnieje
      this.messages = this.messages.filter(m => m.role !== 'system');
      // Dodaj nowy system prompt na początek
      this.messages.unshift({ role, content });
      return;
    }

    // Dodaj nową wiadomość
    this.messages.push({ role, content });

    // Zachowaj tylko ostatnie N wiadomości (nie licząc system prompt)
    const systemMessage = this.messages.find(m => m.role === 'system');
    const nonSystemMessages = this.messages.filter(m => m.role !== 'system');
    
    if (nonSystemMessages.length > this.config.maxMessages) {
      const keepMessages = nonSystemMessages.slice(-this.config.maxMessages);
      this.messages = systemMessage 
        ? [systemMessage, ...keepMessages] 
        : keepMessages;
    }
  }

  getMessages(): Message[] {
    return [...this.messages]; // Zwracamy kopię tablicy aby zapobiec modyfikacji oryginalnej tablicy z zewnątrz
  }

  clearHistory(): void {
    const systemMessage = this.messages.find(m => m.role === 'system');
    this.messages = systemMessage ? [systemMessage] : [];
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

  removeMessage(content: string): void {
    this.messages = this.messages.filter(m => m.content !== content);
  }
} 