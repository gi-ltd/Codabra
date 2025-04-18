import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import { HistoryPanel } from './historyPanel';
import { handleError, ErrorType } from './utils/errorHandler';

export interface ScriptAttachment {
  content: string;
  language: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  context?: string; // Optional context from editor
  script?: ScriptAttachment; // Optional script attachment (for backward compatibility)
  scripts?: ScriptAttachment[]; // Optional multiple script attachments
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

  // Cache for token counts to avoid unnecessary API calls
  private tokenCountCache: Map<string, number> = new Map();
  // Maximum number of entries in the token count cache
  private readonly MAX_CACHE_SIZE = 100;

  // Map to track ongoing requests by chatId
  private activeRequests: Map<string, AbortController> = new Map();

  constructor(storage: vscode.Memento, pastChatsProvider: HistoryPanel) {
    this.storage = storage;
    this.pastChatsProvider = pastChatsProvider;
    this.initializeAnthropicClient();
  }

  /**
   * Initializes or reinitializes the Anthropic client with the current API key
   */
  public initializeAnthropicClient() {
    const apiKey = vscode.workspace.getConfiguration('codabra').get<string>('apiKey');

    if (apiKey) {
      try {
        this.anthropic = new Anthropic({ apiKey: apiKey });
      } catch (error) {
        handleError(error, 'initializing Anthropic client');
        this.anthropic = undefined;
      }
    } else {
      this.anthropic = undefined;
    }
  }

  /**
   * Cancels an ongoing message request for a specific chat
   * @param chatId The ID of the chat to cancel the request for
   * @returns True if a request was cancelled, false otherwise
   */
  public cancelRequest(chatId: string): boolean {
    const controller = this.activeRequests.get(chatId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(chatId);
      return true;
    }
    return false;
  }

  /**
   * Sends a message to the Anthropic API and streams the response
   * @param chatId The ID of the chat to send the message to
   * @param message The message to send
   * @param context Optional context from the editor
   * @param scripts Optional script attachments
   * @returns The assistant's response message, or undefined if there was an error
   */
  public async sendMessage(chatId: string, message: string, context?: string, scripts?: ScriptAttachment[] | ScriptAttachment): Promise<ChatMessage | undefined> {
    // Cancel any existing request for this chat
    this.cancelRequest(chatId);

    if (!this.anthropic) {
      vscode.window.showErrorMessage('Please set your Anthropic API key in the settings');
      return undefined;
    }

    const chat = await this.getChat(chatId);
    if (!chat) {
      vscode.window.showErrorMessage('Chat not found');
      return undefined;
    }

    // Create a new abort controller for this request
    const abortController = new AbortController();
    this.activeRequests.set(chatId, abortController);

    // Add user message to chat
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
      context: context
    };
    
    // Handle script attachments
    if (scripts) {
      if (Array.isArray(scripts)) {
        userMessage.scripts = scripts;
        // Also set the first script as the script property for backward compatibility
        if (scripts.length > 0) {
          userMessage.script = scripts[0];
        }
      } else {
        userMessage.script = scripts;
        userMessage.scripts = [scripts];
      }
    }

    // Create a copy of the chat to avoid race conditions
    const updatedChat: Chat = {
      ...chat,
      messages: [...chat.messages, userMessage],
      updatedAt: Date.now()
    };

    // Update chat title if it's the first user message
    if (updatedChat.messages.length === 1) {
      updatedChat.title = this.generateChatTitle(message);
    }

    // Save the updated chat with the user message
    await this.updateChat(updatedChat);

    try {
      // Get system prompt from settings or use default
      let systemPrompt = vscode.workspace.getConfiguration('codabra').get<string>('systemPrompt') || '';

      if (context) {
        systemPrompt += " Here is some context from the editor that might be relevant: " + context;
      }

      // Create a streaming response
      const extendedThinking = vscode.workspace.getConfiguration('codabra').get<boolean>('extendedThinking') || false;

      const requestOptions: any = {
        model: 'claude-3-7-sonnet-latest',
        messages: updatedChat.messages.map(msg => {
          // Create the base message
          const message: any = { role: msg.role, content: msg.content };
          
          // Handle script attachments for user messages
          if (msg.role === 'user') {
            // Handle multiple scripts if available
            if (msg.scripts && Array.isArray(msg.scripts) && msg.scripts.length > 0) {
              let scriptsContent = '';
              msg.scripts.forEach((script, index) => {
                scriptsContent += `\n\n**Attached Script ${index + 1}: ${script.language}**\n\`\`\`${script.language}\n${script.content}\n\`\`\``;
              });
              message.content += scriptsContent;
            }
            // Handle single script (for backward compatibility)
            else if (msg.script) {
              message.content += `\n\n**Attached Script (${msg.script.language}):**\n\`\`\`${msg.script.language}\n${msg.script.content}\n\`\`\``;
            }
          }
          
          return message;
        }),
        temperature: 1,
        max_tokens: 64000,
        system: systemPrompt,
        thinking: {
          type: extendedThinking ? "enabled" : "disabled"
        }
      };

      // Only add budget_tokens when thinking is enabled
      if (extendedThinking) {
        requestOptions.thinking.budget_tokens = 64000;
      }

      // Create initial assistant message but don't add it to chat yet
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      // Temporary content for UI updates during streaming
      let tempContent = '';

      // Flag to track if the request has been aborted
      let isAborted = false;

      // Set up a listener for the abort event
      abortController.signal.addEventListener('abort', () => {
        isAborted = true;
        console.log('Abort signal received, stream processing will stop');
      });

      // Create the stream without the signal parameter
      const stream = this.anthropic.messages.stream(requestOptions);

      // Process the stream
      try {
        for await (const chunk of stream) {
          // Check if the request has been aborted
          if (isAborted) {
            console.log('Stream processing aborted');
            break;
          }

          if (chunk.type === 'content_block_delta') {
            if (chunk.delta.type === 'text_delta') { // Handle text content
              tempContent += chunk.delta.text;

              // Create a copy of the assistant message with updated content
              const updatedAssistantMessage: ChatMessage = {
                ...assistantMessage,
                content: tempContent
              };

              // Create a temporary chat object with the current message for streaming updates
              const tempChat: Chat = {
                ...updatedChat,
                messages: [...updatedChat.messages, updatedAssistantMessage]
              };

              // Store the temporary chat in memory so it can be retrieved by getChat
              const chats = await this.getAllChats();
              const index = chats.findIndex(c => c.id === chatId);
              if (index !== -1) {
                chats[index] = tempChat;
                // Update in memory only, don't save to storage yet
                await this.storage.update('codabra-chats', chats);

                // Fire the event to update UI in real-time
                this._onDidChangeChats.fire();
              }
            }
          }
        }
      } catch (streamError: unknown) {
        // If the request was aborted, handle it gracefully
        if (isAborted) {
          console.log('Request was cancelled during stream processing');
          this.activeRequests.delete(chatId);
          return undefined;
        }
        // Re-throw other errors to be caught by the outer try-catch
        throw streamError;
      }

      // If the request was aborted, don't save the message
      if (isAborted) {
        console.log('Request was cancelled');

        // Create a partial message to indicate cancellation
        const cancelledMessage: ChatMessage = {
          role: 'assistant',
          content: tempContent + '\n\n[Message generation cancelled by user]',
          timestamp: Date.now()
        };

        // Save the partial message to the chat
        const cancelledChat: Chat = {
          ...updatedChat,
          messages: [...updatedChat.messages, cancelledMessage],
          updatedAt: Date.now()
        };

        // Update the chat with the cancelled message
        await this.updateChat(cancelledChat);

        // Clean up the abort controller
        this.activeRequests.delete(chatId);
        return cancelledMessage;
      }

      // Clean up the abort controller
      this.activeRequests.delete(chatId);

      // Only add the assistant message to chat after successful completion
      const finalAssistantMessage: ChatMessage = {
        role: 'assistant',
        content: tempContent,
        timestamp: Date.now()
      };

      // Create the final updated chat
      const finalChat: Chat = {
        ...updatedChat,
        messages: [...updatedChat.messages, finalAssistantMessage],
        updatedAt: Date.now()
      };

      // Final update to save the completed message
      await this.updateChat(finalChat);

      return finalAssistantMessage;
    } catch (error: unknown) {
      // Clean up the abort controller
      this.activeRequests.delete(chatId);

      // Use standardized error handling
      handleError(error, 'sending message to Anthropic API');

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

  public async chatExists(chatId: string): Promise<boolean> {
    const chats = await this.getAllChats();
    return chats.some(chat => chat.id === chatId);
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

  /**
   * Count tokens for a chat using the Anthropic SDK
   * @param chatId The ID of the chat to count tokens for
   * @param retryCount Number of retries attempted (used internally)
   * @returns The number of tokens used by the chat, or undefined if the SDK is not initialized
   */
  public async countTokens(chatId: string, retryCount: number = 0): Promise<number | undefined> {
    if (!this.anthropic) {
      return undefined;
    }

    const chat = await this.getChat(chatId);
    if (!chat) {
      return undefined;
    }

    // Generate a cache key based on chat content
    const cacheKey = `${chatId}-${chat.updatedAt}`;

    // Check if we have a cached result
    if (this.tokenCountCache.has(cacheKey)) {
      return this.tokenCountCache.get(cacheKey);
    }

    try {
      // Prepare the request for token counting
      const response = await this.anthropic.messages.countTokens({
        model: 'claude-3-7-sonnet-latest',
        messages: chat.messages.map(msg => ({ role: msg.role, content: msg.content })),
        system: vscode.workspace.getConfiguration('codabra').get<string>('systemPrompt') || ''
      });

      // Manage cache size before adding new entry
      this.manageTokenCacheSize();

      // Cache the result
      this.tokenCountCache.set(cacheKey, response.input_tokens);
      return response.input_tokens;
    } catch (error: unknown) {
      // Use standardized error handling but don't show to user for token counting
      handleError(error, 'counting tokens', false);

      // Check if we should retry (up to 2 times)
      if (retryCount < 2) {
        console.log(`Retrying token count for chat ${chatId}, attempt ${retryCount + 1}`);
        // Wait a bit before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retryCount)));
        return this.countTokens(chatId, retryCount + 1);
      }

      // After retries are exhausted, return undefined
      console.log(`Failed to count tokens for chat ${chatId} after ${retryCount} retries`);
      return undefined;
    }
  }

  /**
   * Manages the token count cache size to prevent memory leaks
   * Removes oldest entries when the cache exceeds MAX_CACHE_SIZE
   */
  private manageTokenCacheSize(): void {
    if (this.tokenCountCache.size >= this.MAX_CACHE_SIZE) {
      // Get the oldest entries (first entries in the map)
      const entriesToRemove = this.tokenCountCache.size - this.MAX_CACHE_SIZE + 1;
      const keys = Array.from(this.tokenCountCache.keys()).slice(0, entriesToRemove);

      // Remove the oldest entries
      keys.forEach(key => this.tokenCountCache.delete(key));
    }
  }
}
