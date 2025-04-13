import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import { HistoryPanel } from './historyPanel';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  context?: string; // Optional context from editor
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export class APIService {

  private anthropic: Anthropic | undefined;
  private storage: vscode.Memento;
  private pastChatsProvider: HistoryPanel;
  private _onDidChangeChats = new vscode.EventEmitter<void>();
  public readonly onDidChangeChats = this._onDidChangeChats.event;

  constructor(storage: vscode.Memento, pastChatsProvider: HistoryPanel) {
    this.storage = storage;
    this.pastChatsProvider = pastChatsProvider;
    this.initializeAnthropicClient();
  }

  initializeAnthropicClient() {

    try {

      const apiKey = vscode.workspace.getConfiguration('codabra').get<string>('apiKey');

      if (apiKey) {

        try {
          this.anthropic = new Anthropic({ apiKey: apiKey });
        } catch (clientError) {
          vscode.window.showErrorMessage(`Failed to initialize Anthropic client: ${clientError instanceof Error ? clientError.message : String(clientError)}`);
          this.anthropic = undefined;
        }

      } else
        this.anthropic = undefined;

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to initialize Anthropic client: ${error instanceof Error ? error.message : String(error)}`);
      this.anthropic = undefined;
    }

  }

  public async sendMessage(chatId: string, message: string, context?: string): Promise<ChatMessage | undefined> {

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
      let systemPrompt = vscode.workspace.getConfiguration('codabra').get<string>('systemPrompt');

      if (context)
        systemPrompt += " Here is some context from the editor that might be relevant: " + context;

      // Create a streaming response
      const extendedThinking = vscode.workspace.getConfiguration('codabra').get<boolean>('extendedThinking');

      const requestOptions: any = {
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
      const assistantMessage: ChatMessage = {
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
      for await (const chunk of stream)
        if (chunk.type === 'content_block_delta')
          if (chunk.delta.type === 'text_delta') { // Handle text content
            tempContent += chunk.delta.text;
            assistantMessage.content = tempContent;
            if (chunk.index % 5 === 0) { // Update the UI periodically to show streaming content
              this._onDidChangeChats.fire(); // Just fire the event to update UI without saving to storage
            }
          }

      // Only add the assistant message to chat after successful completion
      assistantMessage.content = tempContent;
      chat.messages.push(assistantMessage);
      chat.updatedAt = Date.now();

      // Final update to save the completed message
      await this.updateChat(chat);

      return assistantMessage;

    } catch (error) {
      console.error('Error sending message to Anthropic API:', error);
      vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  public async createChat(): Promise<Chat> {

    const chat: Chat = {
      id: this.generateUniqueId(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await this.updateChat(chat);
    return chat;

  }

  public async getChat(chatId: string): Promise<Chat | undefined> {
    const chats = await this.getAllChats();
    return chats.find(chat => chat.id === chatId);
  }

  public async getAllChats(): Promise<Chat[]> {
    const chats = this.storage.get<Chat[]>('codabra-chats', []);
    return chats;
  }

  public async updateChat(chat: Chat): Promise<void> {

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

  public async deleteChat(chatId: string): Promise<void> {
    const chats = await this.getAllChats();
    await this.storage.update('codabra-chats', chats.filter(chat => chat.id !== chatId));
    this._onDidChangeChats.fire();
    this.pastChatsProvider.refresh();
  }

  generateUniqueId = (): string => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  generateChatTitle(firstMessage: string): string {

    // Generate a title based on the first message
    const maxLength = 30;
    let title = firstMessage.trim().substring(0, maxLength);

    if (firstMessage.length > maxLength)
      title += '...';

    return title;

  }
}
