"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIService = void 0;
const vscode = __importStar(require("vscode"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
class APIService {
    constructor(storage, pastChatsProvider) {
        this._onDidChangeChats = new vscode.EventEmitter();
        this.onDidChangeChats = this._onDidChangeChats.event;
        // Cache for token counts to avoid unnecessary API calls
        this.tokenCountCache = new Map();
        this.generateUniqueId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        this.storage = storage;
        this.pastChatsProvider = pastChatsProvider;
        this.initializeAnthropicClient();
    }
    initializeAnthropicClient() {
        try {
            const apiKey = vscode.workspace.getConfiguration('codabra').get('apiKey');
            if (apiKey) {
                try {
                    this.anthropic = new sdk_1.default({ apiKey: apiKey });
                }
                catch (clientError) {
                    vscode.window.showErrorMessage(`Failed to initialize Anthropic client: ${clientError instanceof Error ? clientError.message : String(clientError)}`);
                    this.anthropic = undefined;
                }
            }
            else
                this.anthropic = undefined;
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to initialize Anthropic client: ${error instanceof Error ? error.message : String(error)}`);
            this.anthropic = undefined;
        }
    }
    async sendMessage(chatId, message, context) {
        if (!this.anthropic) {
            vscode.window.showErrorMessage('Please set your Anthropic API key in the settings');
            return undefined;
        }
        const chat = await this.getChat(chatId);
        if (!chat)
            return undefined;
        // Add user message to chat
        chat.messages.push({
            role: 'user',
            content: message,
            timestamp: Date.now(),
            context: context
        });
        await this.updateChat(chat);
        try {
            // Get system prompt from settings or use default
            let systemPrompt = vscode.workspace.getConfiguration('codabra').get('systemPrompt');
            if (context)
                systemPrompt += " Here is some context from the editor that might be relevant: " + context;
            // Create a streaming response
            const extendedThinking = vscode.workspace.getConfiguration('codabra').get('extendedThinking');
            const requestOptions = {
                model: 'claude-3-7-sonnet-latest',
                messages: chat.messages.map(msg => ({ role: msg.role, content: msg.content })),
                temperature: 1,
                max_tokens: 64000,
                system: systemPrompt,
                thinking: {
                    type: extendedThinking ? "enabled" : "disabled"
                }
            };
            // Only add budget_tokens when thinking is enabled
            if (extendedThinking)
                requestOptions.thinking.budget_tokens = 64000;
            const stream = this.anthropic.messages.stream(requestOptions);
            // Create initial assistant message but don't add it to chat yet
            const assistantMessage = {
                role: 'assistant',
                content: '',
                timestamp: Date.now()
            };
            // Update chat title if it's the first user message
            if (chat.messages.length === 1)
                chat.title = this.generateChatTitle(message);
            // Temporary content for UI updates during streaming
            let tempContent = '';
            // Process the stream
            for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta') {
                    if (chunk.delta.type === 'text_delta') { // Handle text content
                        tempContent += chunk.delta.text;
                        assistantMessage.content = tempContent;
                        // Create a temporary chat object with the current message for streaming updates
                        const tempChat = { ...chat };
                        tempChat.messages = [...chat.messages, assistantMessage];
                        // Update the chat in memory (but don't save to storage yet)
                        const chats = await this.getAllChats();
                        const index = chats.findIndex(c => c.id === chat.id);
                        if (index !== -1) {
                            chats[index] = tempChat;
                        }
                        // Fire the event to update UI in real-time
                        this._onDidChangeChats.fire();
                    }
                }
            }
            // Only add the assistant message to chat after successful completion
            assistantMessage.content = tempContent;
            chat.messages.push(assistantMessage);
            chat.updatedAt = Date.now();
            // Final update to save the completed message
            await this.updateChat(chat);
            return assistantMessage;
        }
        catch (error) {
            console.error('Error sending message to Anthropic API:', error);
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }
    async createChat() {
        const chat = {
            id: this.generateUniqueId(),
            title: 'New Chat',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        await this.updateChat(chat);
        return chat;
    }
    async getChat(chatId) {
        const chats = await this.getAllChats();
        return chats.find(chat => chat.id === chatId);
    }
    async getAllChats() {
        const chats = this.storage.get('codabra-chats', []);
        return chats;
    }
    async updateChat(chat) {
        const chats = await this.getAllChats();
        const index = chats.findIndex(c => c.id === chat.id);
        if (index !== -1)
            chats[index] = chat;
        else
            chats.push(chat);
        await this.storage.update('codabra-chats', chats);
        this._onDidChangeChats.fire();
        this.pastChatsProvider.refresh();
    }
    async deleteChat(chatId) {
        const chats = await this.getAllChats();
        await this.storage.update('codabra-chats', chats.filter(chat => chat.id !== chatId));
        this._onDidChangeChats.fire();
        this.pastChatsProvider.refresh();
    }
    async chatExists(chatId) {
        const chats = await this.getAllChats();
        return chats.some(chat => chat.id === chatId);
    }
    generateChatTitle(firstMessage) {
        // Generate a title based on the first message
        const maxLength = 30;
        let title = firstMessage.trim().substring(0, maxLength);
        if (firstMessage.length > maxLength)
            title += '...';
        return title;
    }
    /**
     * Count tokens for a chat using the Anthropic SDK
     * @param chatId The ID of the chat to count tokens for
     * @returns The number of tokens used by the chat, or undefined if the SDK is not initialized
     */
    async countTokens(chatId) {
        if (!this.anthropic) {
            vscode.window.showWarningMessage('Cannot count tokens: Anthropic API key not set');
            return undefined;
        }
        const chat = await this.getChat(chatId);
        if (!chat)
            return undefined;
        // Generate a cache key based on chat content
        const cacheKey = `${chatId}-${chat.updatedAt}`;
        // Check if we have a cached result
        if (this.tokenCountCache.has(cacheKey))
            return this.tokenCountCache.get(cacheKey);
        try {
            // Prepare the request for token counting
            const response = await this.anthropic.messages.countTokens({
                model: 'claude-3-7-sonnet-latest',
                messages: chat.messages.map(msg => ({ role: msg.role, content: msg.content })),
                system: vscode.workspace.getConfiguration('codabra').get('systemPrompt') || '' // Get system prompt from settings
            });
            // Based on the Anthropic SDK documentation, the response contains input_tokens. For token counting, we're primarily concerned with input tokens
            const totalTokens = response.input_tokens;
            // Cache the result
            this.tokenCountCache.set(cacheKey, response.input_tokens);
            // Return the total token count
            return totalTokens;
        }
        catch (error) {
            console.error('Error counting tokens:', error);
            vscode.window.showErrorMessage(`Error counting tokens: ${error instanceof Error ? error.message : String(error)}`);
            // Fall back to estimation if the API call fails
            return chat.messages.reduce((total, msg) => total + Math.ceil(msg.content.length / 4), 0);
        }
    }
}
exports.APIService = APIService;
//# sourceMappingURL=apiService.js.map