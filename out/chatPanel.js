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
const fs_1 = require("fs");
class ChatPanel {
    // Listen for changes to chats
    constructor(_extensionUri, _chatProvider) {
        this._extensionUri = _extensionUri;
        this._chatProvider = _chatProvider;
        this._isHandlingMessage = false;
        this._chatProvider.onDidChangeChats(() => {
            if (this._currentChatId && this._view && !this._isHandlingMessage) // Only reload the chat if we're not currently handling a message. This prevents duplicate messages when sending/receiving
                this.loadChat(this._currentChatId);
        });
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'resources')]
        };
        this._update(webviewView.webview).catch(error => vscode.window.showErrorMessage('Failed to initialize chat view' + error));
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await this.sendMessage(message.text);
                    break;
                case 'newChat':
                    await this.createNewChat();
                    break;
                case 'getSettings':
                    this.sendSettings();
                    break;
                case 'saveSettings':
                    await this.saveSettings(message.settings);
                    break;
                case 'openChat':
                    await this.loadChat(message.chatId);
                    break;
                case 'deleteChat':
                    await this._chatProvider.deleteChat(message.chatId);
                    this.showPastChats(); // Refresh the past chats view
                    break;
                case 'setContext':
                    await vscode.commands.executeCommand('setContext', message.key, message.value);
                    break;
            }
        });
    }
    async loadChat(chatId) {
        if (!this._view)
            return;
        try {
            // Set flag to prevent duplicate loading during chat loading
            this._isHandlingMessage = true;
            this._currentChatId = chatId;
            const chat = await this._chatProvider.getChat(chatId);
            if (chat)
                this._view.webview.postMessage({ command: 'loadChat', chat: chat });
        }
        finally {
            // Reset flag when done
            this._isHandlingMessage = false;
        }
    }
    async createNewChat() {
        if (!this._view)
            return;
        try {
            // Set flag to prevent duplicate loading during chat creation
            this._isHandlingMessage = true;
            const chat = await this._chatProvider.createChat();
            this._currentChatId = chat.id;
            this._view.webview.postMessage({ command: 'loadChat', chat: chat });
            // Focus the chat view
            vscode.commands.executeCommand('codabra-view.focus');
        }
        finally {
            // Reset flag when done
            this._isHandlingMessage = false;
        }
    }
    async sendMessage(text) {
        if (!this._view)
            return;
        try {
            // Set flag to prevent duplicate loading during message handling
            this._isHandlingMessage = true;
            if (!this._currentChatId) {
                const chat = await this._chatProvider.createChat();
                this._currentChatId = chat.id;
            }
            // Get context from active editor if available
            let context;
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor)
                if (!activeEditor.selection.isEmpty)
                    context = activeEditor.document.getText(activeEditor.selection); // If there's a selection, use it as context
                else
                    context = `File: ${activeEditor.document.fileName}, Language: ${activeEditor.document.languageId}`; // Otherwise, use the file name and language as context
            this._view.webview.postMessage({ command: 'addUserMessage', message: text });
            this._view.webview.postMessage({ command: 'setLoading', loading: true });
            const response = await this._chatProvider.sendMessage(this._currentChatId, text, context);
            this._view.webview.postMessage({ command: 'setLoading', loading: false });
            if (response)
                this._view.webview.postMessage({ command: 'addAssistantMessage', message: response.content });
        }
        finally {
            // Reset flag when done, regardless of success or failure
            this._isHandlingMessage = false;
        }
    }
    sendSettings() {
        if (!this._view)
            return;
        this._view.webview.postMessage({
            command: 'loadSettings',
            settings: {
                apiKey: vscode.workspace.getConfiguration('codabra').get('apiKey') || '',
                extendedThinking: vscode.workspace.getConfiguration('codabra').get('extendedThinking') || false,
                systemPrompt: vscode.workspace.getConfiguration('codabra').get('systemPrompt') || ''
            }
        });
    }
    async showPastChats() {
        if (!this._view)
            return;
        // Get all chats
        const chats = await this._chatProvider.getAllChats();
        // Send them to the webview
        this._view.webview.postMessage({
            command: 'loadPastChats',
            chats: chats
        });
    }
    showCurrentChat() {
        if (!this._view)
            return;
        // Show the chat view
        this._view.webview.postMessage({
            command: 'showCurrentChat'
        });
    }
    async saveSettings(settings) {
        await vscode.workspace.getConfiguration('codabra').update('apiKey', settings.apiKey, vscode.ConfigurationTarget.Global);
        await vscode.workspace.getConfiguration('codabra').update('extendedThinking', settings.extendedThinking, vscode.ConfigurationTarget.Global);
        await vscode.workspace.getConfiguration('codabra').update('systemPrompt', settings.systemPrompt, vscode.ConfigurationTarget.Global);
        // Reinitialize the Anthropic client with the new API key
        this._chatProvider['initializeAnthropicClient']();
        vscode.window.showInformationMessage('Codabra settings saved');
    }
    async _update(webview) {
        try {
            // Get the resource path. Read the HTML, CSS, and JS content
            const htmlContent = await fs_1.promises.readFile(vscode.Uri.joinPath(this._extensionUri, 'resources', 'chat-panel.html').fsPath, 'utf8');
            const cssContent = await fs_1.promises.readFile(vscode.Uri.joinPath(this._extensionUri, 'resources', 'chat-panel.css').fsPath, 'utf8');
            const jsContent = await fs_1.promises.readFile(vscode.Uri.joinPath(this._extensionUri, 'resources', 'chat-panel.js').fsPath, 'utf8');
            // Find the style tag where we'll inject the CSS
            const styleTagId = 'vscode-css-styles';
            // Find the script tag where we'll inject the JavaScript
            const scriptTagId = 'vscode-js-script';
            let processedHtml = htmlContent;
            // Inject CSS
            if (processedHtml.includes(`id="${styleTagId}"`))
                processedHtml = processedHtml.replace(new RegExp(`<style id="${styleTagId}">.*?</style>`, 's'), `<style id="${styleTagId}">${cssContent}</style>`);
            else
                throw new Error(`Style tag with id="${styleTagId}" not found in HTML template`);
            // Inject JavaScript
            if (processedHtml.includes(`id="${scriptTagId}"`))
                processedHtml = processedHtml.replace(new RegExp(`<script id="${scriptTagId}">.*?</script>`, 's'), `<script id="${scriptTagId}">${jsContent}</script>`);
            else
                throw new Error(`Script tag with id="${scriptTagId}" not found in HTML template`);
            // Set the HTML content
            webview.html = processedHtml;
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to load chat view: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
}
exports.ChatPanel = ChatPanel;
ChatPanel.viewType = 'codabra-view';
//# sourceMappingURL=chatPanel.js.map