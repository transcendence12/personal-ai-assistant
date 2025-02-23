import { OpenAIEmbeddings } from "@langchain/openai";
import { NeonPostgres } from "@langchain/community/vectorstores/neon";
import { Document } from '@langchain/core/documents';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export class VectorMemoryService {
  private embeddings: OpenAIEmbeddings;
  private vectorStore!: NeonPostgres;
  private prisma: PrismaClient;
  private static instance: VectorMemoryService;

  private constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      dimensions: 1536,
      model: "text-embedding-3-small",
    });
    this.prisma = new PrismaClient();
  }

  static async getInstance(): Promise<VectorMemoryService> {
    if (!VectorMemoryService.instance) {
      VectorMemoryService.instance = new VectorMemoryService();
      VectorMemoryService.instance.vectorStore = await NeonPostgres.initialize(
        VectorMemoryService.instance.embeddings,
        {
          connectionString: process.env.DATABASE_URL as string,
        }
      );
    }
    return VectorMemoryService.instance;
  }

  async storeMessage(userId: number, content: string, role: 'user' | 'assistant', type: string = 'conversation'): Promise<void> {
    const conversation = await this.prisma.conversation.upsert({
      where: {
        userId_latest: {
          userId: userId.toString(),
          latest: true
        }
      },
      create: {
        userId: userId.toString(),
        latest: true
      },
      update: {
        updatedAt: new Date()
      }
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        content,
        role
      }
    });

    if (type === 'personal_info' || type === 'important_context') {
      try {
        const doc = {
          pageContent: content,
          metadata: {
            id: crypto.randomUUID(),
            userId: userId.toString(),
            timestamp: new Date().toISOString(),
            type,
            role
          }
        };

        await this.vectorStore.addDocuments([doc]);
      } catch (error) {
        console.error('Error storing document in vector store:', error);
        // Bot będzie działał dalej, nawet jeśli zapis do vector store się nie powiedzie
      }
    }
  }

  async getUserContext(userId: number): Promise<string> {
    const vectorResults = await this.vectorStore.similaritySearch(
      "user information and preferences",
      4,
      {
        userId: userId.toString(),
        type: 'personal_info'
      }
    );

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        userId: userId.toString(),
        latest: true
      },
      select: {
        id: true
      }
    });

    const recentMessages = conversation ? await this.prisma.message.findMany({
      where: {
        conversationId: conversation.id
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 5
    }) : [];

    const vectorContext = vectorResults.map(doc => doc.pageContent).join('\n');
    const conversationContext = recentMessages
      .reverse()
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    return `Personal Information:\n${vectorContext}\n\nRecent Conversation:\n${conversationContext}`;
  }

  async clearUserContext(userId: number): Promise<void> {
    // Implementacja czyszczenia kontekstu użytkownika
  }
} 