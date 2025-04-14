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
exports.ChatPanel = void 0;
const vscode = __importStar(require("vscode"));
const webviewManager_1 = require("./webviewManager");
const chatManager_1 = require("./chatManager");
const settingsManager_1 = require("./settingsManager");
const contextUsageTracker_1 = require("./contextUsageTracker");
/**
 * Main panel class that coordinates between specialized managers
 */
class ChatPanel {
    constructor(_extensionUri, _apiService) {
        this._extensionUri = _extensionUri;
        this._apiService = _apiService;
        // Initialize managers
        this._webviewManager = new webviewManager_1.WebviewManager(_extensionUri);
        this._chatManager = new chatManager_1.ChatManager(_apiService, this._webviewManager);
        this._settingsManager = new settingsManager_1.SettingsManager(this._webviewManager, _apiService);
        this._contextUsageTracker = new contextUsageTracker_1.ContextUsageTracker(this._webviewManager);
    }
    /**
     * Resolves the webview view
     */
    resolveWebviewView(webviewView, _context, _token) {
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
                    }
                    else {
                        await this._chatManager.showPastChats();
                    }
                }
                catch (error) {
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
                    // Handle cancel streaming request
                    // For now, just end the streaming state in the UI
                    // In the future, this could abort the actual API request
                    this._webviewManager.postMessage({ command: 'endStreaming' });
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
    async createNewChat() {
        return this._chatManager.createNewChat();
    }
    /**
     * Loads a chat by ID
     */
    async loadChat(chatId) {
        return this._chatManager.loadChat(chatId);
    }
    /**
     * Shows the past chats view
     */
    async showPastChats() {
        return this._chatManager.showPastChats();
    }
    /**
     * Shows the current chat view
     */
    async showCurrentChat() {
        return this._chatManager.showCurrentChat();
    }
    /**
     * Sends settings to the webview
     */
    sendSettings() {
        return this._settingsManager.sendSettings();
    }
    /**
     * Updates the context usage display
     */
    updateContextUsage(used, total = 200000) {
        return this._contextUsageTracker.updateContextUsage(used, total);
    }
    /**
     * Disposes of resources
     */
    dispose() {
        // Clean up resources
        this._contextUsageTracker.dispose();
    }
}
exports.ChatPanel = ChatPanel;
ChatPanel.viewType = 'codabra-view';
//# sourceMappingURL=chatPanel.js.map