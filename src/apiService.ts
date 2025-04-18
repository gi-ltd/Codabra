import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import { handleError } from './utils/errorHandler';

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
  private _onDidChangeChats = new vscode.EventEmitter<void>();
  public readonly onDidChangeChats = this._onDidChangeChats.event;

  // Simple cache for token counts
  private tokenCountCache = new Map<string, number>();
  private readonly CACHE_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes

  // Map to track ongoing requests by chatId
  private activeRequests: Map<string, AbortController> = new Map();

  constructor(storage: vscode.Memento) {
    this.storage = storage;
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

    // Unified script attachment handling
    if (scripts) {
      const normalizedScripts = Array.isArray(scripts) ? scripts : [scripts];
      userMessage.scripts = normalizedScripts;
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

          // When processing messages for API:
          if (msg.role === 'user' && msg.scripts && msg.scripts.length > 0) {
            let scriptsContent = '';
            msg.scripts.forEach((script, index) => {
              scriptsContent += `\n\n**Script ${index + 1}: ${script.language}**\n\`\`\`${script.language}\n${script.content}\n\`\`\``;
            });
            message.content += scriptsContent;
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
          if (isAborted || abortController.signal.aborted) {
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
              // Get all chats (unsorted) directly from storage
              const chats = this.storage.get<Chat[]>('codabra-chats', []);
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
        // Check if the error is an AbortError
        if (streamError instanceof Error &&
          (streamError.name === 'AbortError' || isAborted || abortController.signal.aborted)) {
          console.log('Request was cancelled during stream processing');
          this.activeRequests.delete(chatId);
          return undefined;
        }
        // Re-throw other errors
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
    // Clear all existing chats since they're no longer accessible
    await this.storage.update('codabra-chats', []);

    const chat: Chat = {
      id: this.generateUniqueId(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Add the new chat to storage
    const chats = this.storage.get<Chat[]>('codabra-chats', []);
    chats.push(chat);
    await this.storage.update('codabra-chats', chats);
    this._onDidChangeChats.fire();

    return chat;
  }

  public async getChat(chatId: string): Promise<Chat | undefined> {
    // Get all chats (unsorted) directly from storage
    const chats = this.storage.get<Chat[]>('codabra-chats', []);
    return chats.find(chat => chat.id === chatId);
  }


  public async updateChat(chat: Chat): Promise<void> {
    // Get all chats (unsorted) directly from storage
    const chats = this.storage.get<Chat[]>('codabra-chats', []);
    const index = chats.findIndex(c => c.id === chat.id);

    if (index !== -1)
      chats[index] = chat;
    else
      chats.push(chat);

    // Save the updated chats to storage
    await this.storage.update('codabra-chats', chats);
    this._onDidChangeChats.fire();
  }


  public async chatExists(chatId: string): Promise<boolean> {
    // Get all chats (unsorted) directly from storage
    const chats = this.storage.get<Chat[]>('codabra-chats', []);
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

    // If there are no messages, return 0 tokens
    if (!chat.messages || chat.messages.length === 0) {
      return 0;
    }

    // Generate a simple cache key
    const cacheKey = `${chatId}-${chat.updatedAt}`;

    // Check if we have a cached result
    if (this.tokenCountCache.has(cacheKey)) {
      return this.tokenCountCache.get(cacheKey);
    }

    // Clean up expired cache entries
    this.cleanupExpiredCache();

    try {
      // Prepare messages for token counting
      const messages = chat.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Ensure we have at least one message
      if (messages.length === 0) {
        // If somehow we have no messages after mapping, add a dummy message
        messages.push({ role: 'user', content: ' ' });
      }

      // Get system prompt
      const systemPrompt = vscode.workspace.getConfiguration('codabra').get<string>('systemPrompt') || '';

      // Prepare the request for token counting
      const response = await this.anthropic.messages.countTokens({
        model: 'claude-3-7-sonnet-latest',
        messages: messages,
        system: systemPrompt
      });

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
   * Cleans up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expirationThreshold = now - this.CACHE_EXPIRATION_MS;

    // Remove expired entries
    for (const [key, _] of this.tokenCountCache.entries()) {
      const parts = key.split('-');
      if (parts.length >= 2) {
        const timestamp = parseInt(parts[1], 10);
        if (!isNaN(timestamp) && timestamp < expirationThreshold) {
          this.tokenCountCache.delete(key);
        }
      }
    }

    // Limit cache size to 100 entries
    if (this.tokenCountCache.size > 100) {
      const keysToDelete = Array.from(this.tokenCountCache.keys())
        .sort((a, b) => {
          const timestampA = parseInt(a.split('-')[1], 10) || 0;
          const timestampB = parseInt(b.split('-')[1], 10) || 0;
          return timestampA - timestampB;
        })
        .slice(0, this.tokenCountCache.size - 100);

      keysToDelete.forEach(key => this.tokenCountCache.delete(key));
    }
  }
}
