import { Message, MessageSchema } from '../../types/chat';

export class MessageHistoryService {
  private static readonly MAX_MESSAGES = 3;
  private messages: Message[] = [];

  addMessage(role: Message['role'], content: string): void {
    const message = MessageSchema.parse({ role, content });
    this.messages.push(message);
    
    if (this.messages.length > MessageHistoryService.MAX_MESSAGES) {
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
} 