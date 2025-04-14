import * as vscode from 'vscode';
import { APIService, ChatMessage } from './apiService';
import { WebviewManager } from './webviewManager';

/**
 * Manages chat operations including creating, loading, and sending messages
 */
export class ChatManager {
  private _currentChatId?: string;
  private _isHandlingMessage = false;

  constructor(
    private readonly _apiService: APIService,
    private readonly _webviewManager: WebviewManager
  ) {
    // Listen for changes to chats
    this._apiService.onDidChangeChats(() => {
      if (this._currentChatId && this._webviewManager.view && !this._isHandlingMessage) {
        // Only reload the chat if we're not currently handling a message
        // This prevents duplicate messages when sending/receiving
        this.loadChat(this._currentChatId);
      }
    });
  }

  /**
   * Gets the current chat ID
   */
  public get currentChatId(): string | undefined {
    return this._currentChatId;
  }

  /**
   * Loads a chat by ID
   */
  public async loadChat(chatId: string): Promise<void> {
    if (!this._webviewManager.view) {
      return;
    }

    try {
      // Set flag to prevent duplicate loading during chat loading
      this._isHandlingMessage = true;

      const chat = await this._apiService.getChat(chatId);

      if (chat) {
        this._currentChatId = chatId;

        // Update context to indicate we have a current chat
        await vscode.commands.executeCommand('setContext', 'codabra.hasCurrentChat', true);

        this._webviewManager.postMessage({ command: 'loadChat', chat: chat });

        // Update context usage after loading a chat using the Anthropic SDK's token counting
        this._apiService.countTokens(chatId).then(tokens => {
          if (tokens) {
            this.updateContextUsage(tokens);
          }
        });
      } else {
        // If the chat doesn't exist, clear the current chat ID and show past chats
        this._currentChatId = undefined;

        // Update context to indicate we don't have a current chat
        await vscode.commands.executeCommand('setContext', 'codabra.hasCurrentChat', false);

        this.showPastChats();
      }
    } finally {
      // Reset flag when done
      this._isHandlingMessage = false;
    }
  }

  /**
   * Creates a new chat
   */
  public async createNewChat(): Promise<void> {
    if (!this._webviewManager.view) {
      return;
    }

    try {
      // Set flag to prevent duplicate loading during chat creation
      this._isHandlingMessage = true;

      const chat = await this._apiService.createChat();
      this._currentChatId = chat.id;

      // Update context to indicate we have a current chat
      await vscode.commands.executeCommand('setContext', 'codabra.hasCurrentChat', true);

      this._webviewManager.postMessage({ command: 'loadChat', chat: chat });

      // Reset context usage when creating a new chat
      this.updateContextUsage(0);

      // Focus the chat view
      vscode.commands.executeCommand('codabra-view.focus');
    } finally {
      // Reset flag when done
      this._isHandlingMessage = false;
    }
  }

  /**
   * Sends a message to the current chat
   */
  public async sendMessage(text: string): Promise<void> {
    if (!this._webviewManager.view) {
      return;
    }

    try {
      // Set flag to prevent duplicate loading during message handling
      this._isHandlingMessage = true;

      // Ensure we have a valid chat to send the message to
      if (!this._currentChatId || !(await this._apiService.chatExists(this._currentChatId))) {
        const chat = await this._apiService.createChat();
        this._currentChatId = chat.id;
      }

      // Get context from active editor if available
      let context: string | undefined;
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        context = activeEditor.selection.isEmpty
          ? `File: ${activeEditor.document.fileName}, Language: ${activeEditor.document.languageId}`
          : activeEditor.document.getText(activeEditor.selection);
      }

      // Update UI to show user message and start streaming state
      this._webviewManager.postMessage({ command: 'addUserMessage', message: text });
      this._webviewManager.postMessage({ command: 'startStreaming' });

      // Set up a listener for chat updates during streaming
      const chatUpdateListener = this._apiService.onDidChangeChats(() => {
        // Only process updates if we're still in streaming mode
        if (this._isHandlingMessage && this._currentChatId) {
          this._apiService.getChat(this._currentChatId).then(chat => {
            if (chat && chat.messages.length > 0) {
              // Find the last assistant message that's being generated
              // It might not be the last message in the chat yet
              for (let i = chat.messages.length - 1; i >= 0; i--) {
                const msg = chat.messages[i];
                if (msg.role === 'assistant') {
                  // Send the update to the UI
                  this._webviewManager.postMessage({
                    command: 'updateStreamingContent',
                    content: msg.content
                  });
                  break;
                }
              }
            }
          });
        }
      });

      // Send the message and get response
      const response = await this._apiService.sendMessage(this._currentChatId, text, context);

      // Remove the listener after streaming is complete
      chatUpdateListener.dispose();

      this._webviewManager.postMessage({ command: 'endStreaming' });

      if (response) {
        this._webviewManager.postMessage({ command: 'addAssistantMessage', message: response.content });

        // Update context usage based on the current chat using the Anthropic SDK's token counting
        this._apiService.countTokens(this._currentChatId).then(tokens => {
          if (tokens) {
            this.updateContextUsage(tokens);
          }
        });
      }
    } finally {
      // Reset flag when done, regardless of success or failure
      this._isHandlingMessage = false;
    }
  }

  /**
   * Shows the past chats view
   */
  public async showPastChats(): Promise<void> {
    if (!this._webviewManager.view) {
      return;
    }

    // Get all chats
    const chats = await this._apiService.getAllChats();

    // Update context to indicate whether there's a current chat
    const hasCurrentChat = this._currentChatId !== undefined &&
      await this._apiService.chatExists(this._currentChatId);

    await vscode.commands.executeCommand('setContext', 'codabra.hasCurrentChat', hasCurrentChat);

    // Send them to the webview
    this._webviewManager.postMessage({ command: 'loadPastChats', chats: chats });
  }

  /**
   * Shows the current chat view
   */
  public async showCurrentChat(): Promise<void> {
    if (!this._webviewManager.view) {
      return;
    }

    // If there's no current chat ID or the chat doesn't exist anymore, show past chats
    if (!this._currentChatId || !(await this._apiService.chatExists(this._currentChatId))) {
      this._currentChatId = undefined;
      return this.showPastChats();
    }

    // Show the chat view
    this._webviewManager.postMessage({ command: 'showCurrentChat' });

    // Update context usage when returning to the chat view using the Anthropic SDK's token counting
    this._apiService.countTokens(this._currentChatId).then(tokens => {
      if (tokens) {
        this.updateContextUsage(tokens);
      }
    });
  }

  /**
   * Deletes a chat by ID
   */
  public async deleteChat(chatId: string): Promise<void> {
    if (this._currentChatId === chatId) {
      // Check if the deleted chat is the current chat
      this._currentChatId = undefined;
      await vscode.commands.executeCommand('setContext', 'codabra.hasCurrentChat', false);
    }

    await this._apiService.deleteChat(chatId);
    this.showPastChats(); // Refresh the past chats view
  }

  /**
   * Updates the context usage display
   */
  public updateContextUsage(used: number, total: number = 200000): void {
    if (!this._webviewManager.view) {
      return;
    }

    // Send context usage update to the webview
    this._webviewManager.postMessage({
      command: 'updateContextUsage',
      used: used,
      total: total
    });

    // Update the last known token usage in the extension
    if (used > 0) {
      vscode.commands.executeCommand('codabra.updateContextUsage', used);
    }
  }
}
