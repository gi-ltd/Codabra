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
exports.SimpleChatPanel = void 0;
const vscode = __importStar(require("vscode"));
class SimpleChatPanel {
    static createOrShow(extensionUri, chatProvider) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // If we already have a panel, show it
        if (SimpleChatPanel.currentPanel) {
            SimpleChatPanel.currentPanel._panel.reveal(column);
            return;
        }
        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel('simpleChatPanel', 'Simple Chat', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        SimpleChatPanel.currentPanel = new SimpleChatPanel(panel, extensionUri, chatProvider);
    }
    constructor(panel, extensionUri, chatProvider) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._chatProvider = chatProvider;
        // Set initial content
        this._update();
        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(message => {
            console.log('Received message from webview:', message);
            switch (message.command) {
                case 'sendMessage':
                    vscode.window.showInformationMessage(`Message sent: ${message.text}`);
                    // Echo the message back
                    this._panel.webview.postMessage({
                        command: 'receiveMessage',
                        text: `You said: ${message.text}`,
                        role: 'assistant'
                    });
                    return;
            }
        }, null, this._disposables);
    }
    _update() {
        this._panel.webview.html = this._getHtmlForWebview();
        console.log('Simple chat panel HTML set');
    }
    _getHtmlForWebview() {
        return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Simple Chat</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                height: 100vh;
                display: flex;
                flex-direction: column;
            }
            .chat-container {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .message {
                margin-bottom: 15px;
                padding: 10px;
                border-radius: 5px;
                max-width: 80%;
            }
            .user-message {
                background-color: #dcf8c6;
                align-self: flex-end;
                margin-left: auto;
            }
            .assistant-message {
                background-color: #ffffff;
                align-self: flex-start;
                margin-right: auto;
            }
            .input-container {
                display: flex;
                padding: 10px;
                border-top: 1px solid #ccc;
            }
            .message-input {
                flex: 1;
                padding: 10px;
                border: 1px solid #ccc;
                border-radius: 4px;
                margin-right: 10px;
            }
            .send-button {
                padding: 10px 20px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
        </style>
    </head>
    <body>
        <div class="chat-container" id="chat-container">
            <div class="message assistant-message">Hello! This is a simple chat interface. How can I help you today?</div>
        </div>
        <div class="input-container">
            <input type="text" class="message-input" id="message-input" placeholder="Type your message...">
            <button class="send-button" id="send-button">Send</button>
        </div>
        <script>
            const vscode = acquireVsCodeApi();
            const chatContainer = document.getElementById('chat-container');
            const messageInput = document.getElementById('message-input');
            const sendButton = document.getElementById('send-button');

            // Send message when Send button is clicked
            sendButton.addEventListener('click', sendMessage);

            // Send message when Enter is pressed
            messageInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });

            function sendMessage() {
                const text = messageInput.value.trim();
                if (text) {
                    // Add user message to chat
                    addMessage(text, 'user');
                    
                    // Send message to extension
                    vscode.postMessage({
                        command: 'sendMessage',
                        text: text
                    });
                    
                    // Clear input
                    messageInput.value = '';
                }
            }

            function addMessage(content, role) {
                const messageElement = document.createElement('div');
                messageElement.className = 'message ' + role + '-message';
                messageElement.textContent = content;
                chatContainer.appendChild(messageElement);
                
                // Scroll to bottom
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                console.log('Received message from extension:', message);
                
                switch (message.command) {
                    case 'receiveMessage':
                        addMessage(message.text, message.role);
                        break;
                }
            });

            // Let the extension know the webview is ready
            vscode.postMessage({
                command: 'webviewReady'
            });
        </script>
    </body>
    </html>`;
    }
    dispose() {
        SimpleChatPanel.currentPanel = undefined;
        // Clean up resources
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
exports.SimpleChatPanel = SimpleChatPanel;
//# sourceMappingURL=simpleChatPanel.js.map