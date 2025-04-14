import * as vscode from 'vscode';
import { Chat } from './apiService';
import { handleError } from './utils/errorHandler';

export class ChatTreeItem extends vscode.TreeItem {

  constructor(public readonly chat: Chat, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(chat.title, collapsibleState);
    this.tooltip = `${chat.title} - ${new Date(chat.updatedAt).toLocaleString()}`;
    this.description = new Date(chat.updatedAt).toLocaleString();
    this.contextValue = 'chat';
    this.command = {
      command: 'codabra.openChat',
      title: 'Open Chat',
      arguments: [chat.id]
    };

    // Use VSCode theme icons
    this.iconPath = new vscode.ThemeIcon('comment');
  }
}

export class HistoryPanel implements vscode.TreeDataProvider<ChatTreeItem> {

  private _onDidChangeTreeData: vscode.EventEmitter<ChatTreeItem | undefined | null | void> = new vscode.EventEmitter<ChatTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ChatTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private storage: vscode.Memento;

  constructor(storage: vscode.Memento) {
    this.storage = storage;

    // Register commands
    vscode.commands.registerCommand('codabra.deleteChat', async (item: ChatTreeItem) => {
      try {
        await this.storage.update('codabra-chats', this.storage.get<Chat[]>('codabra-chats', []).filter(chat => chat.id !== item.chat.id));
        this.refresh();
      } catch (error) {
        // Use standardized error handling
        handleError(error, 'deleting chat');
      }
    });
  }

  refresh = (): void => this._onDidChangeTreeData.fire();

  getTreeItem = (element: ChatTreeItem): vscode.TreeItem => element;

  async getChildren(element?: ChatTreeItem): Promise<ChatTreeItem[]> {
    if (element)
      return [];

    const chats = this.storage.get<Chat[]>('codabra-chats', []);

    if (!chats || chats.length === 0)
      return [];

    // Sort chats by updatedAt (most recent first)
    return [...chats].sort((a, b) => b.updatedAt - a.updatedAt).map(chat => new ChatTreeItem(chat, vscode.TreeItemCollapsibleState.None));
  }
}
