import { OpenAIEmbeddings } from "@langchain/openai";
import { NeonPostgres } from "@langchain/community/vectorstores/neon";
import { Document } from '@langchain/core/documents';
import { neon } from '@neondatabase/serverless';
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { StateGraph, MessagesAnnotation, MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

export class VectorMemoryService {
  private embeddings: OpenAIEmbeddings;
  private vectorStore!: NeonPostgres;
  private textSplitter: RecursiveCharacterTextSplitter;
  private static instance: VectorMemoryService;
  private chatPrompt: ChatPromptTemplate;
  private messageMemory: MemorySaver;
  private llm: ChatOpenAI;
  private stateGraph: StateGraph<typeof MessagesAnnotation>;

  private constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      dimensions: 1536,
      model: "text-embedding-3-small",
    });

    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0,
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 200,
      chunkOverlap: 50,
      separators: ["\n\n", "\n", ".", "!", "?", ",", " ", ""],
      keepSeparator: true,
    });

    // Dodajemy template dla bota
    this.chatPrompt = ChatPromptTemplate.fromMessages([
      ["system", "Jesteś pomocnym asystentem o imieniu Harry. Pamiętasz informacje o użytkowniku z kontekstu."],
      new MessagesPlaceholder("history"),
      ["system", "KONTEKST UŻYTKOWNIKA:\n{context}"],
      ["human", "{input}"]
    ]);

    // Konfigurujemy trimmer dla historii wiadomości
    this.messageMemory = new MemorySaver();

    // Konfigurujemy graf konwersacji
    const workflow = new StateGraph(MessagesAnnotation)
      .addNode("chat", this.handleChat.bind(this))
      .addEdge("chat", "chat");

    workflow.compile({ checkpointer: this.messageMemory });

    // Konfiguracja grafu dla zarządzania stanem
    this.stateGraph = new StateGraph(MessagesAnnotation);
    this.stateGraph
      .addNode("memory", this.handleMemory.bind(this))
      .addEdge("memory", "memory");

    // Kompilacja grafu z checkpointerem
    this.stateGraph.compile({ checkpointer: this.messageMemory });
  }

  static async getInstance(): Promise<VectorMemoryService> {
    if (!VectorMemoryService.instance) {
      VectorMemoryService.instance = new VectorMemoryService();
      await VectorMemoryService.instance.initialize();
    }
    return VectorMemoryService.instance;
  }

  private async initialize() {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      
      // Najpierw sprawdzamy czy tabela istnieje
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'vectorstore_documents'
        );
      `;

      // Tworzymy tabelę tylko jeśli nie istnieje
      if (!tableExists[0].exists) {
        console.log('Creating vectorstore_documents table...');
        
        // Utworzenie rozszerzenia vector jeśli nie istnieje
        await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
        
        // Utworzenie tabeli tylko jeśli nie istnieje
        await sql`
          CREATE TABLE IF NOT EXISTS vectorstore_documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            text TEXT NOT NULL,
            metadata JSONB,
            embedding vector(1536)
          );
        `;
      } else {
        console.log('Table vectorstore_documents already exists');
      }

      // Inicjalizacja vector store
      this.vectorStore = await NeonPostgres.initialize(
        this.embeddings,
        {
          connectionString: process.env.DATABASE_URL as string,
          tableName: 'vectorstore_documents',
        }
      );
    } catch (error) {
      console.error('Error initializing vector store:', error);
      throw error;
    }
  }

  private async handleMemory(state: typeof MessagesAnnotation.State) {
    // Logika obsługi pamięci
    return state;
  }

  private async handleChat(state: typeof MessagesAnnotation.State) {
    try {
      // Bierzemy ostatnie 10 wiadomości
      const recentMessages = state.messages.slice(-10);

      // Pobieramy kontekst użytkownika
      const userId = this.extractUserId(state);
      const context = await this.getUserContext(userId);

      // Formatujemy prompt z kontekstem
      const prompt = await this.chatPrompt.invoke({
        history: recentMessages,
        context: context,
        input: state.messages[state.messages.length - 1].content
      });

      // Wywołujemy model
      const response = await this.llm.invoke(prompt);

      return { messages: [...state.messages, response] };
    } catch (error) {
      console.error('Error in chat handler:', error);
      throw error;
    }
  }

  private extractUserId(state: any): number {
    // Implementacja wyciągania userId ze stanu
    return state.configurable?.userId || 0;
  }

  private async summarizeMessages(messages: Document[]): Promise<string> {
    if (messages.length < 5) return messages.map(m => m.pageContent).join('\n');

    const summaryPrompt = `Podsumuj tę rozmowę po polsku, zachowując wszystkie ważne informacje osobiste i preferencje:
    ${messages.map(m => m.pageContent).join('\n')}
    
    Ważne: Zachowaj wszystkie informacje o:
    - imieniu
    - miejscu zamieszkania
    - preferencjach
    - innych istotnych faktach osobistych`;

    const response = await this.llm.invoke([
      { role: "system", content: "Podsumuj rozmowę po polsku, zachowując wszystkie informacje osobiste." },
      { role: "user", content: summaryPrompt }
    ]);

    if (Array.isArray(response.content)) {
      return response.content.map(content => 
        typeof content === 'string' ? content : JSON.stringify(content)
      ).join(' ');
    }
    
    return typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);
  }

  async storeMessage(userId: number, content: string, role: 'user' | 'assistant', type: string = 'conversation'): Promise<void> {
    try {
      console.log('Storing message:', { userId, content, role, type });

      // Określamy typ informacji
      const contentType = this.detectInfoType(content);
      const isPersonalInfo = type === 'personal_info' || contentType !== 'other';
      const finalType = isPersonalInfo ? 'personal_info' : type;

      // Dzielimy tekst na chunki
      const chunks = await this.textSplitter.splitText(content);
      console.log(`Split message into ${chunks.length} chunks`);

      // Pobieramy istniejące wiadomości i tworzymy podsumowanie jeśli jest ich dużo
      const existingMessages = await this.vectorStore.similaritySearch("", 10, { userId: userId.toString() });
      if (existingMessages.length > 8) {
        const summary = await this.summarizeMessages(existingMessages);
        await this.vectorStore.addDocuments([{
          pageContent: summary,
          metadata: { userId: userId.toString(), type: 'summary', role: 'system' }
        }]);
      }

      // Zapisujemy każdy chunk z odpowiednimi metadanymi
      for (const [index, chunk] of chunks.entries()) {
        const doc = {
          pageContent: chunk,
          metadata: {
            userId: userId.toString(),
            timestamp: new Date().toISOString(),
            type: finalType,
            role,
            contentType,
            chunkIndex: index,
            totalChunks: chunks.length,
            originalContent: content, // Zachowujemy oryginalną wiadomość
            isPersonalInfo
          }
        };

        await this.vectorStore.addDocuments([doc]);
      }
    } catch (error) {
      console.error('Error storing document in vector store:', error);
    }
  }

  async getUserContext(userId: number): Promise<string> {
    try {
      console.log('Getting context for user:', userId);

      // Szukamy konkretnych informacji osobistych
      const personalInfo = await this.vectorStore.similaritySearch(
        "lubię preferuję mieszkam mam na imię nazywam się", // Zapytanie po polsku
        20, // Zwiększamy limit
        { 
          userId: userId.toString(),
          type: 'personal_info'
        }
      );

      // Filtrujemy i kategoryzujemy informacje
      const userInfo = {
        name: personalInfo.find(doc => 
          doc.pageContent.toLowerCase().includes('mam na imię') ||
          doc.pageContent.toLowerCase().includes('nazywam się')
        )?.pageContent,
        location: personalInfo.find(doc => 
          doc.pageContent.toLowerCase().includes('mieszkam')
        )?.pageContent,
        likes: personalInfo.filter(doc => 
          doc.pageContent.toLowerCase().includes('lubię') ||
          doc.pageContent.toLowerCase().includes('lubie')
        ).map(doc => doc.pageContent)
      };

      // Budujemy kontekst z znalezionych informacji
      const contextParts = [];
      if (userInfo.name) contextParts.push(userInfo.name);
      if (userInfo.location) contextParts.push(userInfo.location);
      if (userInfo.likes.length > 0) contextParts.push(...userInfo.likes);

      const context = contextParts.join('\n');
      console.log('Extracted user info:', userInfo);
      return context;
    } catch (error) {
      console.error('Error retrieving user context:', error);
      return '';
    }
  }

  async clearUserContext(userId: number): Promise<void> {
    // Możemy zaimplementować później, jeśli będzie potrzebne
  }

  async debugDatabase(): Promise<void> {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const results = await sql`
        SELECT text, metadata 
        FROM vectorstore_documents 
        ORDER BY metadata->>'timestamp' DESC 
        LIMIT 5;
      `;
      console.log('Recent database entries:', results);
    } catch (error) {
      console.error('Error debugging database:', error);
    }
  }

  private detectInfoType(content: string): string {
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('mam na imię') || 
        lowerContent.includes('nazywam się') ||
        lowerContent.includes('mam na imie') ||
        lowerContent.includes('jestem') ||
        /me.*call.*|my.*name.*is/i.test(content)) return 'name';
    if (lowerContent.includes('mieszkam')) return 'location';
    if (lowerContent.includes('lubię') || 
        lowerContent.includes('lubie') ||
        lowerContent.includes('podoba mi się')) return 'preferences';
    return 'other';
  }
} 