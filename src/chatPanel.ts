import * as vscode from 'vscode';
import { APIService } from './apiService';
import { WebviewManager } from './webviewManager';
import { ChatManager } from './chatManager';
import { SettingsManager, CodabraSettings } from './settingsManager';
import { ContextUsageTracker } from './contextUsageTracker';

/**
 * Main panel class that coordinates between specialized managers
 */
export class ChatPanel {
  public static readonly viewType = 'codabra-view';
  private _panel: vscode.WebviewPanel | undefined;

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
   * Creates and shows the webview panel
   */
  public async createOrShowPanel(): Promise<void> {
    // If we already have a panel, show it
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Otherwise, create a new panel
    this._panel = vscode.window.createWebviewPanel(
      ChatPanel.viewType,
      'Codabra',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'src/resources')]
      }
    );

    // Add icon to the panel
    this._panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'icon.png');

    // Initialize the webview
    await this._webviewManager.initializePanel(this._panel)
      .catch(error => vscode.window.showErrorMessage('Failed to initialize chat view: ' + error));

    // Initialize context usage tracker
    this._contextUsageTracker.initialize();

    // Register panel state change listener
    this._panel.onDidChangeViewState(async e => {
      if (e.webviewPanel.visible && this._chatManager.currentChatId) {
        try {
          const exists = await this._apiService.chatExists(this._chatManager.currentChatId);
          if (exists) {
            // Directly load the chat when the panel becomes visible
            await this._chatManager.loadChat(this._chatManager.currentChatId);
          } else {
            await this._chatManager.createNewChat();
          }
        } catch (error) {
          console.error('Error restoring chat on visibility change:', error);
          await this._chatManager.createNewChat();
        }
      }
    });

    // Handle panel disposal
    this._panel.onDidDispose(() => {
      this._panel = undefined;
    }, null, this._webviewManager.disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'sendMessage':
          await this._chatManager.sendMessage(message.text, message.script);
          break;
        case 'getActiveEditorContent':
          this.sendActiveEditorContent();
          break;
        case 'selectFileForScript':
          this.selectFileForScript();
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
   * Sends the active editor content to the webview
   */
  private sendActiveEditorContent(): void {
    // Try to get the active text editor
    const editor = vscode.window.activeTextEditor;

    if (editor && editor.document) {
      const document = editor.document;
      const content = document.getText();
      const language = document.languageId;

      this._webviewManager.postMessage({
        command: 'activeEditorContent',
        content: content,
        language: language
      });
      return; // Successfully sent active editor content
    }

    // If no active editor is found, try to get content from the visible editors
    const visibleEditors = vscode.window.visibleTextEditors;
    if (visibleEditors && visibleEditors.length > 0) {
      // Use the first visible editor
      const firstEditor = visibleEditors[0];
      const document = firstEditor.document;
      const content = document.getText();
      const language = document.languageId;

      this._webviewManager.postMessage({
        command: 'activeEditorContent',
        content: content,
        language: language
      });
      return; // Successfully sent visible editor content
    }

    // If still no editor is found, immediately open the file picker dialog
    // instead of showing a message and waiting
    this.selectFileForScript();
  }

  /**
   * Opens a file picker and sends the selected file content to the webview
   */
  private async selectFileForScript(): Promise<void> {
    try {
      // Show file picker dialog
      const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: 'Select File to Attach',
        filters: {
          'All Files': ['*']
        }
      });

      if (fileUris && fileUris.length > 0) {
        // Read the selected file
        const fileUri = fileUris[0];
        const document = await vscode.workspace.openTextDocument(fileUri);
        const content = document.getText();
        const language = document.languageId;

        // Send the file content to the webview
        this._webviewManager.postMessage({
          command: 'activeEditorContent',
          content: content,
          language: language
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error selecting file: ${error}`);

      // Fallback to manual input
      const manualInput = await vscode.window.showInputBox({
        prompt: 'No file selected. You can manually enter a language for your code:',
        placeHolder: 'javascript, python, typescript, etc.'
      });

      if (manualInput) {
        // Show input box for code content
        const codeContent = await vscode.window.showInputBox({
          prompt: 'Enter your code:',
          placeHolder: 'Paste or type your code here'
          // Note: VSCode's standard input box doesn't support multiline input
        });

        if (codeContent) {
          this._webviewManager.postMessage({
            command: 'activeEditorContent',
            content: codeContent,
            language: manualInput
          });
        }
      }
    }
  }


  /**
   * Disposes of resources
   */
  public dispose(): void {
    // Clean up resources
    this._contextUsageTracker.dispose();

    // Dispose of the panel if it exists
    if (this._panel) {
      this._panel.dispose();
      this._panel = undefined;
    }
  }
}
