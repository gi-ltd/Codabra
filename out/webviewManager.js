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
exports.WebviewManager = void 0;
const vscode = __importStar(require("vscode"));
const fs_1 = require("fs");
/**
 * Manages the webview initialization and communication
 */
class WebviewManager {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    /**
     * Gets the current webview
     */
    get view() {
        return this._view;
    }
    /**
     * Initializes the webview
     */
    async initialize(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'resources')]
        };
        await this.updateWebviewContent(webviewView.webview);
    }
    /**
     * Sends a message to the webview
     */
    postMessage(message) {
        if (!this._view) {
            return Promise.resolve(false);
        }
        return this._view.webview.postMessage(message);
    }
    /**
     * Updates the webview content by loading HTML, CSS, and JS
     */
    async updateWebviewContent(webview) {
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
exports.WebviewManager = WebviewManager;
//# sourceMappingURL=webviewManager.js.map