import * as vscode from 'vscode';
import { APIService } from './apiService';
import { ChatPanel } from './chatPanel';
import { ResourceManager } from './utils/resourceManager';
import { EventManager } from './utils/eventManager';
import { LockManager } from './utils/lockManager';
import { handleError } from './utils/errorHandler';

let chatPanel: ChatPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  try {
    // Initialize the chat panel
    chatPanel = new ChatPanel(
      context.extensionUri,
      new APIService(context.globalState)
    );

    // Register commands
    const updateContextUsageCommand = vscode.commands.registerCommand('codabra.updateContextUsage', (used: number) => {
      if (chatPanel) {
        chatPanel.updateContextUsage(used, 200000);
      }
    });
    context.subscriptions.push(updateContextUsageCommand);
    ResourceManager.registerDisposable(updateContextUsageCommand);

    // Register other commands
    const commands = [
      vscode.commands.registerCommand('codabra.startChat', async () => {
        if (!chatPanel) return;
        await chatPanel.createOrShowPanel();
        return chatPanel.createNewChat();
      }),
      vscode.commands.registerCommand('codabra.openSettings', async () => {
        if (!chatPanel) return;
        await chatPanel.createOrShowPanel();
        chatPanel.sendSettings();
      }),
      vscode.commands.registerCommand('codabra.showCurrentChat', async () => {
        if (!chatPanel) return;
        await chatPanel.createOrShowPanel();
        chatPanel.showCurrentChat();
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
    // Dispose of the chat panel
    if (chatPanel) {
      chatPanel.dispose();
      chatPanel = undefined;
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
