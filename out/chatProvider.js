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
exports.ChatProvider = void 0;
const vscode = __importStar(require("vscode"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
class ChatProvider {
    constructor(storage, pastChatsProvider) {
        this._onDidChangeChats = new vscode.EventEmitter();
        this.onDidChangeChats = this._onDidChangeChats.event;
        this.generateUniqueId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        this.storage = storage;
        this.pastChatsProvider = pastChatsProvider;
        this.initializeAnthropicClient();
    }
    initializeAnthropicClient() {
        try {
            const apiKey = vscode.workspace.getConfiguration('anthropic-chat').get('apiKey');
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
        const userMessage = {
            role: 'user',
            content: message,
            timestamp: Date.now(),
            context: context
        };
        chat.messages.push(userMessage);
        await this.updateChat(chat);
        try {
            // Prepare system prompt with context if available
            let systemPrompt = "You are Claude, an AI assistant by Anthropic, helping with coding and other tasks in VSCode.";
            if (context)
                systemPrompt += " Here is some context from the editor that might be relevant: " + context;
            // Create a streaming response
            const stream = this.anthropic.messages.stream({
                model: 'claude-3-7-sonnet-latest',
                messages: chat.messages.map(msg => ({ role: msg.role, content: msg.content })),
                temperature: 1,
                max_tokens: 64000,
                system: systemPrompt,
                thinking: {
                    type: vscode.workspace.getConfiguration('anthropic-chat').get('extendedThinking') ? "enabled" : "disabled",
                    budget_tokens: 64000
                }
            });
            // Create initial assistant message
            const assistantMessage = {
                role: 'assistant',
                content: '',
                timestamp: Date.now()
            };
            chat.messages.push(assistantMessage);
            // Update chat title if it's the first message
            if (chat.messages.length === 2)
                chat.title = this.generateChatTitle(message);
            chat.updatedAt = Date.now();
            await this.updateChat(chat);
            // Process the stream
            for await (const chunk of stream)
                if (chunk.type === 'content_block_delta')
                    if (chunk.delta.type === 'text_delta') { // Handle text content
                        assistantMessage.content += chunk.delta.text;
                        if (chunk.index % 5 === 0) // Update the chat periodically to show streaming content. This is throttled to avoid too many updates
                            await this.updateChat(chat);
                    }
            // Final update to ensure all content is saved
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
        const chats = this.storage.get('anthropic-chats', []);
        return chats;
    }
    async updateChat(chat) {
        const chats = await this.getAllChats();
        const index = chats.findIndex(c => c.id === chat.id);
        if (index !== -1)
            chats[index] = chat;
        else
            chats.push(chat);
        await this.storage.update('anthropic-chats', chats);
        this._onDidChangeChats.fire();
        this.pastChatsProvider.refresh();
    }
    async deleteChat(chatId) {
        const chats = await this.getAllChats();
        await this.storage.update('anthropic-chats', chats.filter(chat => chat.id !== chatId));
        this._onDidChangeChats.fire();
        this.pastChatsProvider.refresh();
    }
    generateChatTitle(firstMessage) {
        // Generate a title based on the first message
        const maxLength = 30;
        let title = firstMessage.trim().substring(0, maxLength);
        if (firstMessage.length > maxLength)
            title += '...';
        return title;
    }
}
exports.ChatProvider = ChatProvider;
//# sourceMappingURL=chatProvider.js.map