# Harry - AI Assistant Bot

A sophisticated Telegram bot powered by OpenAI's GPT-4, DALL-E, and Whisper, enhanced with real-time web search capabilities through Tavily API. Harry acts as an experienced freelance mentor, capable of handling text conversations, generating images, analyzing photos, and processing voice messages in both English and Polish.

## 🌟 Features

### 💬 Conversational AI
- Powered by GPT-4 Turbo for natural language understanding
- Maintains conversation context
- Bilingual support (English and Polish)
- Configurable response temperature for creativity control
- Customizable in-memory message history length

### 🔍 Real-time Web Search
- Integration with Tavily API for current information
- Smart search triggering based on query context
- Focus on post-December 2023 content
- Automatic source attribution
- Fallback mechanisms for comprehensive results

### 🎨 Image Capabilities
- DALL-E 3 integration for image generation
- Image analysis and description
- Support for multiple image formats (JPG, JPEG, PNG, WebP)
- Detailed visual explanations
- Context-aware image generation

### 🎤 Voice Processing
- Voice message transcription using Whisper
- Automatic language detection
- Support for OGG to MP3 conversion
- Progress tracking during processing
- Size limit handling (25MB max)

## 🚀 Getting Started

### Prerequisites
- Node.js (Latest LTS version)
- npm or yarn
- Telegram Bot Token
- OpenAI API Key
- Tavily API Key

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd personal-ai-assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` file with your credentials:
   - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `TAVILY_API_KEY`: Your Tavily API key

4. Build and start the bot:
   ```bash
   npm run build
   npm start
   ```

For development:
   ```bash
   npm run dev
   ```

## 🤖 Bot Commands

- `/start` - Initialize the bot
- `/help` - Display available commands and capabilities
- `/search <query>` - Search for current information
- `/generate <description>` - Generate images using DALL-E
- `/analyze` - Analyze images (send image after command)
- `/history <number>` - Set message history length
- `/temp <0.0-2.0>` - Adjust response creativity
- `/lang <pl|en>` - Change bot language

## 🏗️ Technical Architecture

### Core Services
- `OpenAIService`: Manages interactions with OpenAI APIs
- `TavilyService`: Handles web search functionality
- `MessageHistoryService`: Manages conversation context

### Handlers
- `CommandHandler`: Processes bot commands
- `ChatHandler`: Manages message interactions
- `ImageHandler`: Processes image-related operations
- `VoiceHandler`: Handles voice message processing

### Type Safety
- Comprehensive TypeScript implementation
- Zod schema validation for runtime type safety
- Interface-driven development

## 🔧 Configuration

The bot is highly configurable through environment variables and runtime commands:

- Language: Polish (default) or English
- Message history length
- Response temperature (creativity level)
- API endpoints and tokens
- Server settings

## 🛠️ Development

### Project Structure
```
src/
├── config/     # Configuration files
├── handlers/   # Command and message handlers
├── services/   # Core services (AI, History, etc.)
├── types/      # TypeScript type definitions
└── index.ts    # Application entry point
```

### Key Technologies
- TypeScript
- OpenAI API (GPT-4, DALL-E 3, Whisper)
- Tavily API
- grammY (Telegram Bot Framework)
- Zod (Runtime type validation)
- FFmpeg (Audio processing)

## 📋 TODO & Future Improvements

### 💾 Database Integration
- Implement conversation history persistence
- Add support for:
  - User preferences storage
  - Conversation backups
  - Analytics and usage statistics
  - Multi-user session management

### 🔄 Planned Features
- Rate limiting and usage tracking
- User authentication and authorization
- Custom personality templates
- Conversation export/import
- Integration with more AI models
- Advanced error handling and recovery
- Performance optimizations

### 🧪 Testing
- Add unit tests coverage
- Implement integration tests
- Add end-to-end testing
- Performance benchmarking

## 📝 License

ISC License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

