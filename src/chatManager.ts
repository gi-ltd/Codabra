import * as vscode from 'vscode';
import { APIService } from './apiService';
import { WebviewManager } from './webviewManager';
import { LockManager } from './utils/lockManager';
import { EventManager } from './utils/eventManager';
import { handleError } from './utils/errorHandler';

/**
 * Manages chat operations including creating, loading, and sending messages
 */
export class ChatManager {
  private _currentChatId?: string;
  private _isHandlingMessage = false;
  private _isStreaming = false;

  constructor(
    private readonly _apiService: APIService,
    private readonly _webviewManager: WebviewManager
  ) {
    // Listen for changes to chats
    this._apiService.onDidChangeChats(() => {
      if (this._currentChatId && this._webviewManager.webview) {
        if (this._isHandlingMessage && this._isStreaming) {
          // During streaming, we want to update the UI with the latest content
          // but we don't want to reload the entire chat
          this.updateStreamingContent();
        } else if (!this._isHandlingMessage) {
          // Only reload the chat if we're not currently handling a message
          // This prevents duplicate messages when sending/receiving
          this.loadChat(this._currentChatId);
        }
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
    if (!this._webviewManager.webview) {
      return;
    }

    // Use LockManager to prevent race conditions
    await LockManager.executeWithLock(`chat-load-${chatId}`, async () => {
      try {
        // Set flag to prevent duplicate loading during chat loading
        this._isHandlingMessage = true;

        const chat = await this._apiService.getChat(chatId);

        if (chat) {
          this._currentChatId = chatId;

          // Update context to indicate we have a current chat
          EventManager.setVSCodeContext('codabra.hasCurrentChat', true);

          this._webviewManager.postMessage({ command: 'loadChat', chat: chat });

          // Update context usage after loading a chat using the Anthropic SDK's token counting
          this._apiService.countTokens(chatId).then(tokens => {
            if (tokens) {
              this.updateContextUsage(tokens);
            }
          }).catch(error => handleError(error, 'counting tokens', false));
        } else {
          // If the chat doesn't exist, clear the current chat ID and create a new chat
          this._currentChatId = undefined;

          // Update context to indicate we don't have a current chat
          EventManager.setVSCodeContext('codabra.hasCurrentChat', false);

          // Create a new chat instead of showing past chats
          this.createNewChat();
        }
      } catch (error) {
        handleError(error, 'loading chat');
      } finally {
        // Reset flag when done
        this._isHandlingMessage = false;
      }
    });

    return;
  }

  /**
   * Creates a new chat
   */
  public async createNewChat(): Promise<void> {
    if (!this._webviewManager.webview) {
      return;
    }

    // Use LockManager to prevent race conditions
    await LockManager.executeWithLock('chat-create', async () => {
      try {
        // Set flag to prevent duplicate loading during chat creation
        this._isHandlingMessage = true;

        const chat = await this._apiService.createChat();
        this._currentChatId = chat.id;

        // Update context to indicate we have a current chat
        EventManager.setVSCodeContext('codabra.hasCurrentChat', true);

        this._webviewManager.postMessage({ command: 'loadChat', chat: chat });

        // Reset context usage when creating a new chat
        this.updateContextUsage(0);

        // No need to focus the chat view here as it's already shown by createOrShowPanel
        // The command 'codabra-view.focus' is not registered and causes an error
      } catch (error) {
        handleError(error, 'creating new chat');
      } finally {
        // Reset flag when done
        this._isHandlingMessage = false;
      }
    });

    return;
  }

  /**
   * Sends a message to the current chat
   */
  public async sendMessage(text: string, scripts?: { content: string; language: string }[] | { content: string; language: string }): Promise<void> {
    if (!this._webviewManager.webview) {
      return;
    }

    // Use LockManager to prevent race conditions
    await LockManager.executeWithLock('chat-send-message', async () => {
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
        this._webviewManager.postMessage({
          command: 'addUserMessage',
          message: text,
          script: scripts
        });
        this._webviewManager.postMessage({ command: 'startStreaming' });

        // Set streaming flag
        this._isStreaming = true;

        try {
          // Send the message and get response
          const response = await this._apiService.sendMessage(this._currentChatId, text, context, scripts);

          if (response) {
            // First end streaming UI state to remove the streaming message element
            this._webviewManager.postMessage({ command: 'endStreaming' });

            // Then add the final message
            this._webviewManager.postMessage({ command: 'addAssistantMessage', message: response.content });

            // Update context usage based on the current chat using the Anthropic SDK's token counting
            try {
              const tokens = await this._apiService.countTokens(this._currentChatId);
              if (tokens) {
                this.updateContextUsage(tokens);
              }
            } catch (error) {
              handleError(error, 'counting tokens', false);
            }
          }
        } catch (error) {
          handleError(error, 'sending message');

          // End streaming UI state in case of error
          this._webviewManager.postMessage({ command: 'endStreaming' });
        } finally {
          // Reset streaming flag
          this._isStreaming = false;

          // Reset flag when done, regardless of success or failure
          this._isHandlingMessage = false;
        }
      } catch (error) {
        // Handle any errors that occur during setup
        handleError(error, 'setting up message sending');

        // Reset flags and end streaming UI state
        this._isStreaming = false;
        this._isHandlingMessage = false;
        this._webviewManager.postMessage({ command: 'endStreaming' });
      }
    });

    return;
  }

  /**
   * Updates the streaming content in the UI
   * This is called when a chat update is received during streaming
   */
  private async updateStreamingContent(): Promise<void> {
    if (!this._currentChatId || !this._isStreaming || !this._webviewManager.webview) {
      return;
    }

    try {
      const chat = await this._apiService.getChat(this._currentChatId);
      if (chat && chat.messages.length > 0) {
        // Find the last assistant message that's being generated
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
    } catch (error) {
      // Use standardized error handling but don't show to user
      handleError(error, 'updating streaming content', false);
    }
  }

  /**
   * Shows the current chat view
   */
  public async showCurrentChat(): Promise<void> {
    if (!this._webviewManager.webview) {
      return;
    }

    // If there's no current chat ID or the chat doesn't exist anymore, create a new chat
    if (!this._currentChatId || !(await this._apiService.chatExists(this._currentChatId))) {
      this._currentChatId = undefined;
      return this.createNewChat();
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
   * Cancels the current streaming response
   */
  public cancelStreaming(): void {
    if (!this._currentChatId || !this._isStreaming) {
      return;
    }

    try {
      // Cancel the API request
      const cancelled = this._apiService.cancelRequest(this._currentChatId);

      if (cancelled) {
        console.log(`Cancelled streaming for chat ${this._currentChatId}`);

        // Update the UI to show the cancellation
        this._webviewManager.postMessage({
          command: 'endStreaming',
          cancelled: true
        });

        // Load the chat to show the cancelled message
        this.loadChat(this._currentChatId);
      }
    } catch (error) {
      // Handle any errors during cancellation
      handleError(error, 'cancelling streaming', false);

      // Ensure UI is updated even if cancellation fails
      this._webviewManager.postMessage({
        command: 'endStreaming',
        cancelled: true
      });
    } finally {
      // Always reset streaming flag
      this._isStreaming = false;
    }
  }

  /**
   * Updates the context usage display
   */
  public updateContextUsage(used: number, total: number = 200000): void {
    if (!this._webviewManager.webview) {
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
