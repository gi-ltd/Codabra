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
// Store a reference to the chat panel for cleanup
let chatViewProvider;
function activate(context) {
    try {
        // Initialize storage for past chats. Create chat view provider
        chatViewProvider = new chatPanel_1.ChatPanel(context.extensionUri, new apiService_1.APIService(context.globalState, new historyPanel_1.HistoryPanel(context.globalState)));
        // Register the chat view provider
        context.subscriptions.push(vscode.window.registerWebviewViewProvider(chatPanel_1.ChatPanel.viewType, chatViewProvider));
        // Register command to update context usage (used by ChatManager)
        context.subscriptions.push(vscode.commands.registerCommand('codabra.updateContextUsage', (used) => {
            if (chatViewProvider) {
                chatViewProvider.updateContextUsage(used, 200000);
            }
        }));
        // Register commands
        context.subscriptions.push(vscode.commands.registerCommand('codabra.startChat', async () => {
            if (!chatViewProvider)
                return;
            await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first
            return chatViewProvider.createNewChat(); // Then create a new chat
        }), vscode.commands.registerCommand('codabra.viewPastChats', async () => {
            if (!chatViewProvider)
                return;
            await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first
            return chatViewProvider.showPastChats(); // Then show the past chats
        }), vscode.commands.registerCommand('codabra.openChat', async (chatId) => {
            if (!chatViewProvider)
                return;
            await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first
            return chatViewProvider.loadChat(chatId); // Then load the chat
        }), vscode.commands.registerCommand('codabra.openSettings', async () => {
            if (!chatViewProvider)
                return;
            await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first
            chatViewProvider.sendSettings(); // Then show the settings UI
        }), vscode.commands.registerCommand('codabra.showCurrentChat', async () => {
            if (!chatViewProvider)
                return;
            await vscode.commands.executeCommand('codabra-view.focus'); // Focus the chat view first
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
        // Dispose of the chat panel if it exists
        if (chatViewProvider) {
            chatViewProvider.dispose();
            chatViewProvider = undefined;
        }
        console.log('Codabra extension deactivated');
    }
    catch (error) {
        console.error('Error during extension deactivation:', error);
    }
}
//# sourceMappingURL=extension.js.map