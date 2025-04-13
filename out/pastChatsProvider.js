"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PastChatsProvider = exports.ChatTreeItem = void 0;
const vscode = __importStar(require("vscode"));
class ChatTreeItem extends vscode.TreeItem {
    constructor(chat, collapsibleState) {
        super(chat.title, collapsibleState);
        this.chat = chat;
        this.collapsibleState = collapsibleState;
        this.tooltip = `${chat.title} - ${new Date(chat.updatedAt).toLocaleString()}`;
        this.description = new Date(chat.updatedAt).toLocaleString();
        this.contextValue = 'chat';
        this.command = {
            command: 'anthropic-chat.openChat',
            title: 'Open Chat',
            arguments: [chat.id]
        };
        // Use VSCode theme icons
        this.iconPath = new vscode.ThemeIcon('comment');
    }
}
exports.ChatTreeItem = ChatTreeItem;
class PastChatsProvider {
    constructor(storage) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.refresh = () => this._onDidChangeTreeData.fire();
        this.getTreeItem = (element) => element;
        this.storage = storage;
        // Register commands
        vscode.commands.registerCommand('anthropic-chat.deleteChat', async (item) => {
            try {
                await this.storage.update('anthropic-chats', this.storage.get('anthropic-chats', []).filter(chat => chat.id !== item.chat.id));
                this.refresh();
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to delete chat: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    async getChildren(element) {
        if (element)
            return [];
        const chats = this.storage.get('anthropic-chats', []);
        if (!chats || chats.length === 0)
            return [];
        // Sort chats by updatedAt (most recent first)
        const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
        return sortedChats.map(chat => new ChatTreeItem(chat, vscode.TreeItemCollapsibleState.None));
    }
}
exports.PastChatsProvider = PastChatsProvider;
//# sourceMappingURL=pastChatsProvider.js.map