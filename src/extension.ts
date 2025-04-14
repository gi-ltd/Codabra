import * as vscode from 'vscode';
import { APIService } from './apiService';
import { HistoryPanel } from './historyPanel';
import { ChatPanel } from './chatPanel';
import { ResourceManager } from './utils/resourceManager';
import { EventManager } from './utils/eventManager';
import { LockManager } from './utils/lockManager';
import { handleError } from './utils/errorHandler';

let chatViewProvider: ChatPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  try {
    // Initialize the chat panel
    chatViewProvider = new ChatPanel(
      context.extensionUri,
      new APIService(context.globalState, new HistoryPanel(context.globalState))
    );

    // Register the webview provider
    const webviewProvider = vscode.window.registerWebviewViewProvider(ChatPanel.viewType, chatViewProvider);
    context.subscriptions.push(webviewProvider);

    // Register all disposables with ResourceManager for proper cleanup
    ResourceManager.registerDisposable(webviewProvider);

    // Register commands
    const updateContextUsageCommand = vscode.commands.registerCommand('codabra.updateContextUsage', (used: number) => {
      if (chatViewProvider) {
        chatViewProvider.updateContextUsage(used, 200000);
      }
    });
    context.subscriptions.push(updateContextUsageCommand);
    ResourceManager.registerDisposable(updateContextUsageCommand);

    // Register other commands
    const commands = [
      vscode.commands.registerCommand('codabra.startChat', async () => {
        if (!chatViewProvider) return;
        await vscode.commands.executeCommand('codabra-view.focus');
        return chatViewProvider.createNewChat();
      }),
      vscode.commands.registerCommand('codabra.viewPastChats', async () => {
        if (!chatViewProvider) return;
        await vscode.commands.executeCommand('codabra-view.focus');
        return chatViewProvider.showPastChats();
      }),
      vscode.commands.registerCommand('codabra.openChat', async (chatId: string) => {
        if (!chatViewProvider) return;
        await vscode.commands.executeCommand('codabra-view.focus');
        return chatViewProvider.loadChat(chatId);
      }),
      vscode.commands.registerCommand('codabra.openSettings', async () => {
        if (!chatViewProvider) return;
        await vscode.commands.executeCommand('codabra-view.focus');
        chatViewProvider.sendSettings();
      }),
      vscode.commands.registerCommand('codabra.showCurrentChat', async () => {
        if (!chatViewProvider) return;
        await vscode.commands.executeCommand('codabra-view.focus');
        chatViewProvider.showCurrentChat();
      })
    ];

    // Add all commands to context subscriptions and ResourceManager
    for (const command of commands) {
      context.subscriptions.push(command);
      ResourceManager.registerDisposable(command);
    }
  } catch (error) {
    handleError(error, 'activating extension');
  }
}

export function deactivate() {
  try {
    // Dispose of the chat view provider
    if (chatViewProvider) {
      chatViewProvider.dispose();
      chatViewProvider = undefined;
    }

    // Clean up all resources
    ResourceManager.disposeAll();

    // Clear all event manager debounce timers
    EventManager.clearAllDebounceTimers();

    // Clear all locks
    LockManager.clearAllLocks();

    console.log('Codabra extension deactivated and resources cleaned up');
  } catch (error) {
    console.error('Error during extension deactivation:', error);
  }
}
