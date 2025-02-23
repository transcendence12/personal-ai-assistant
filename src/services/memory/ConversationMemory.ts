interface Message {
  type: 'human' | 'ai';
  content: string;
}

export class ConversationMemory {
  private messages: Message[];
  private static readonly MAX_HISTORY = 10;

  constructor() {
    this.messages = [];
  }

  async addMessage(role: 'human' | 'ai', content: string): Promise<void> {
    this.messages.push({
      type: role,
      content: content,
    });

    // Keep only the last MAX_HISTORY * 2 messages (pairs of human and AI messages)
    if (this.messages.length > ConversationMemory.MAX_HISTORY * 2) {
      this.messages = this.messages.slice(-ConversationMemory.MAX_HISTORY * 2);
    }
  }

  async getHistory(): Promise<string> {
    return this.messages
      .map((m: Message) => `${m.type}: ${m.content}`)
      .join('\n');
  }

  async clear(): Promise<void> {
    this.messages = [];
  }
} 