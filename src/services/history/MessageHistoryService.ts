import { Message, MessageSchema } from '../../types/chat';

interface HistoryConfig {
  maxMessages: number;
}

export class MessageHistoryService {
  private messages: Message[] = [];
  private config: HistoryConfig;

  constructor(config?: Partial<HistoryConfig>) {
    this.config = {
      maxMessages: config?.maxMessages || 3,
    };
  }

  setMaxMessages(maxMessages: number): void {
    this.config.maxMessages = maxMessages;
    while (this.messages.length > maxMessages) {
      this.messages.shift();
    }
  }

  addMessage(role: Message['role'], content: string): void {
    const message = MessageSchema.parse({ role, content });
    this.messages.push(message);
    
    if (this.messages.length > this.config.maxMessages) {
      this.messages.shift();
    }
  }

  getMessages(): Message[] {
    return this.messages;
  }

  summarizeConversation(): string {
    if (this.messages.length === 0) return '';
    
    return this.messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  clear(): void {
    this.messages = [];
  }

  getConfig(): HistoryConfig {
    return { ...this.config };
  }
} 