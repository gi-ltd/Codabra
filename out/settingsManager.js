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
exports.SettingsManager = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Manages settings operations
 */
class SettingsManager {
    constructor(_webviewManager, _apiService) {
        this._webviewManager = _webviewManager;
        this._apiService = _apiService;
    }
    /**
     * Loads and sends settings to the webview
     */
    sendSettings() {
        if (!this._webviewManager.view) {
            return;
        }
        const settings = {
            apiKey: vscode.workspace.getConfiguration('codabra').get('apiKey') || '',
            extendedThinking: vscode.workspace.getConfiguration('codabra').get('extendedThinking') || false,
            systemPrompt: vscode.workspace.getConfiguration('codabra').get('systemPrompt') || ''
        };
        this._webviewManager.postMessage({
            command: 'loadSettings',
            settings: settings
        });
    }
    /**
     * Saves settings to VSCode configuration
     */
    async saveSettings(settings) {
        // Update API key
        await vscode.workspace.getConfiguration('codabra').update('apiKey', settings.apiKey, vscode.ConfigurationTarget.Global);
        // Update extended thinking setting
        await vscode.workspace.getConfiguration('codabra').update('extendedThinking', settings.extendedThinking, vscode.ConfigurationTarget.Global);
        // Update system prompt
        await vscode.workspace.getConfiguration('codabra').update('systemPrompt', settings.systemPrompt, vscode.ConfigurationTarget.Global);
        // Reinitialize the Anthropic client with the new API key
        this._apiService['initializeAnthropicClient']();
        vscode.window.showInformationMessage('Codabra settings saved');
    }
    /**
     * Gets the current settings
     */
    getSettings() {
        return {
            apiKey: vscode.workspace.getConfiguration('codabra').get('apiKey') || '',
            extendedThinking: vscode.workspace.getConfiguration('codabra').get('extendedThinking') || false,
            systemPrompt: vscode.workspace.getConfiguration('codabra').get('systemPrompt') || ''
        };
    }
}
exports.SettingsManager = SettingsManager;
//# sourceMappingURL=settingsManager.js.map