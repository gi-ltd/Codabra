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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const apiService_1 = require("./apiService");
const historyPanel_1 = require("./historyPanel");
const chatPanel_1 = require("./chatPanel");
function activate(context) {
    try {
        // Initialize storage for past chats. Create chat view provider
        const chatViewProvider = new chatPanel_1.ChatPanel(context.extensionUri, new apiService_1.APIService(context.globalState, new historyPanel_1.HistoryPanel(context.globalState)));
        // Register the chat view provider
        context.subscriptions.push(vscode.window.registerWebviewViewProvider(chatPanel_1.ChatPanel.viewType, chatViewProvider));
        // Register commands
        context.subscriptions.push(vscode.commands.registerCommand('codabra.startChat', async () => {
            await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first
            return chatViewProvider.createNewChat(); // Then create a new chat
        }), vscode.commands.registerCommand('codabra.viewPastChats', async () => {
            await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first to ensure it's visible
            return chatViewProvider.showPastChats(); // Then show the past chats in the webview
        }), vscode.commands.registerCommand('codabra.openChat', async (chatId) => {
            await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first
            return chatViewProvider.loadChat(chatId); // Then load the chat
        }), vscode.commands.registerCommand('codabra.openSettings', async () => {
            await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first to ensure it's visible
            chatViewProvider.sendSettings(); // Then show the settings UI
        }), vscode.commands.registerCommand('codabra.showCurrentChat', async () => {
            await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first to ensure it's visible
            chatViewProvider.showCurrentChat(); // Then show the current chat
        }));
    }
    catch (error) {
        vscode.window.showErrorMessage(`Codabra extension failed to activate: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function deactivate() {
    // Clean up resources
    try {
        // Dispose of any remaining subscriptions or resources
        // This ensures proper cleanup when the extension is deactivated
        console.log('Codabra extension deactivated');
    }
    catch (error) {
        console.error('Error during extension deactivation:', error);
    }
}
//# sourceMappingURL=extension.js.map