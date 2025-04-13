import * as vscode from 'vscode';
import { APIService } from './apiService';
import { HistoryPanel } from './historyPanel';
import { ChatPanel } from './chatPanel';

export function activate(context: vscode.ExtensionContext) {

  try {

    // Initialize storage for past chats. Create chat view provider
    const chatViewProvider = new ChatPanel(context.extensionUri, new APIService(context.globalState, new HistoryPanel(context.globalState)));

    // Register the chat view provider
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(ChatPanel.viewType, chatViewProvider));

    // Register commands
    context.subscriptions.push(
      vscode.commands.registerCommand('codabra.startChat', async () => {
        await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first
        return chatViewProvider.createNewChat(); // Then create a new chat
      }),
      vscode.commands.registerCommand('codabra.viewPastChats', async () => {
        await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first to ensure it's visible
        return chatViewProvider.showPastChats(); // Then show the past chats in the webview
      }),
      vscode.commands.registerCommand('codabra.openChat', async (chatId: string) => {
        await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first
        return chatViewProvider.loadChat(chatId); // Then load the chat
      }),
      vscode.commands.registerCommand('codabra.openSettings', async () => {
        await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first to ensure it's visible
        chatViewProvider.sendSettings(); // Then show the settings UI
      }),
      vscode.commands.registerCommand('codabra.showCurrentChat', async () => {
        await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first to ensure it's visible
        chatViewProvider.showCurrentChat(); // Then show the current chat
      })
    );

  } catch (error) {
    vscode.window.showErrorMessage(`Codabra extension failed to activate: ${error instanceof Error ? error.message : String(error)}`);
  }

}

export function deactivate() {
  // Clean up resources
  try {
    // Dispose of any remaining subscriptions or resources
    // This ensures proper cleanup when the extension is deactivated
    console.log('Codabra extension deactivated');
  } catch (error) {
    console.error('Error during extension deactivation:', error);
  }
}
