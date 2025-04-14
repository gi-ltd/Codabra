import * as vscode from 'vscode';
import { APIService } from './apiService';
import { WebviewManager } from './webviewManager';
import { ChatManager } from './chatManager';
import { SettingsManager, CodabraSettings } from './settingsManager';
import { ContextUsageTracker } from './contextUsageTracker';

/**
 * Main panel class that coordinates between specialized managers
 */
export class ChatPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codabra-view';

  private _webviewManager: WebviewManager;
  private _chatManager: ChatManager;
  private _settingsManager: SettingsManager;
  private _contextUsageTracker: ContextUsageTracker;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _apiService: APIService
  ) {
    // Initialize managers
    this._webviewManager = new WebviewManager(_extensionUri);
    this._chatManager = new ChatManager(_apiService, this._webviewManager);
    this._settingsManager = new SettingsManager(this._webviewManager, _apiService);
    this._contextUsageTracker = new ContextUsageTracker(this._webviewManager);
  }

  /**
   * Resolves the webview view
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    // Initialize the webview
    this._webviewManager.initialize(webviewView)
      .catch(error => vscode.window.showErrorMessage('Failed to initialize chat view: ' + error));

    // Initialize context usage tracker
    this._contextUsageTracker.initialize();

    // Register visibility change listener
    webviewView.onDidChangeVisibility(async () => {
      // Only act when the view becomes visible
      if (webviewView.visible && this._chatManager.currentChatId) {
        try {
          const exists = await this._apiService.chatExists(this._chatManager.currentChatId);
          if (exists) {
            // Directly load the chat when the view becomes visible
            await this._chatManager.loadChat(this._chatManager.currentChatId);
          } else {
            await this._chatManager.showPastChats();
          }
        } catch (error) {
          console.error('Error restoring chat on visibility change:', error);
          await this._chatManager.showPastChats();
        }
      }
    });

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'sendMessage':
          await this._chatManager.sendMessage(message.text);
          break;
        case 'newChat':
          await this._chatManager.createNewChat();
          break;
        case 'getSettings':
          this._settingsManager.sendSettings();
          break;
        case 'saveSettings':
          await this._settingsManager.saveSettings(message.settings);
          break;
        case 'openChat':
          await this._chatManager.loadChat(message.chatId);
          break;
        case 'deleteChat':
          await this._chatManager.deleteChat(message.chatId);
          break;
        case 'cancelStreaming':
          // Cancel the streaming request in the API
          this._chatManager.cancelStreaming();
          // The UI streaming state will be ended by the ChatManager
          break;
        case 'setContext':
          await vscode.commands.executeCommand('setContext', message.key, message.value);
          break;
      }
    });
  }

  /**
   * Creates a new chat
   */
  public async createNewChat(): Promise<void> {
    return this._chatManager.createNewChat();
  }

  /**
   * Loads a chat by ID
   */
  public async loadChat(chatId: string): Promise<void> {
    return this._chatManager.loadChat(chatId);
  }

  /**
   * Shows the past chats view
   */
  public async showPastChats(): Promise<void> {
    return this._chatManager.showPastChats();
  }

  /**
   * Shows the current chat view
   */
  public async showCurrentChat(): Promise<void> {
    return this._chatManager.showCurrentChat();
  }

  /**
   * Sends settings to the webview
   */
  public sendSettings(): void {
    return this._settingsManager.sendSettings();
  }

  /**
   * Updates the context usage display
   */
  public updateContextUsage(used: number, total: number = 200000): void {
    return this._contextUsageTracker.updateContextUsage(used, total);
  }

  /**
   * Disposes of resources
   */
  public dispose(): void {
    // Clean up resources
    this._contextUsageTracker.dispose();
  }
}
