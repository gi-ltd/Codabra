import * as vscode from 'vscode';
import { APIService } from './apiService';
import { HistoryPanel } from './historyPanel';
import { ChatPanel } from './chatPanel';

// Store a reference to the chat panel for cleanup
let chatViewProvider: ChatPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  try {
    // Initialize storage for past chats. Create chat view provider
    chatViewProvider = new ChatPanel(
      context.extensionUri,
      new APIService(context.globalState, new HistoryPanel(context.globalState))
    );

    // Register the chat view provider
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(ChatPanel.viewType, chatViewProvider)
    );

    // Register command to update context usage (used by ChatManager)
    context.subscriptions.push(
      vscode.commands.registerCommand('codabra.updateContextUsage', (used: number) => {
        if (chatViewProvider) {
          chatViewProvider.updateContextUsage(used, 200000);
        }
      })
    );

    // Register commands
    context.subscriptions.push(
      vscode.commands.registerCommand('codabra.startChat', async () => {
        if (!chatViewProvider) return;
        await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first
        return chatViewProvider.createNewChat(); // Then create a new chat
      }),
      vscode.commands.registerCommand('codabra.viewPastChats', async () => {
        if (!chatViewProvider) return;
        await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first
        return chatViewProvider.showPastChats(); // Then show the past chats
      }),
      vscode.commands.registerCommand('codabra.openChat', async (chatId: string) => {
        if (!chatViewProvider) return;
        await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first
        return chatViewProvider.loadChat(chatId); // Then load the chat
      }),
      vscode.commands.registerCommand('codabra.openSettings', async () => {
        if (!chatViewProvider) return;
        await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first
        chatViewProvider.sendSettings(); // Then show the settings UI
      }),
      vscode.commands.registerCommand('codabra.showCurrentChat', async () => {
        if (!chatViewProvider) return;
        await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first
        chatViewProvider.showCurrentChat(); // Then show the current chat
      })
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Codabra extension failed to activate: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function deactivate() {
  // Clean up resources
  try {
    // Dispose of the chat panel if it exists
    if (chatViewProvider) {
      chatViewProvider.dispose();
      chatViewProvider = undefined;
    }

    console.log('Codabra extension deactivated');
  } catch (error) {
    console.error('Error during extension deactivation:', error);
  }
}
