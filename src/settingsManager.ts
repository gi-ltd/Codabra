import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';
import { APIService } from './apiService';

/**
 * Interface for Codabra settings
 */
export interface CodabraSettings {
    apiKey: string;
    extendedThinking: boolean;
    systemPrompt: string;
}

/**
 * Manages settings operations
 */
export class SettingsManager {
    constructor(
        private readonly _webviewManager: WebviewManager,
        private readonly _apiService: APIService
    ) { }

    /**
     * Loads and sends settings to the webview
     */
    public sendSettings(): void {
        if (!this._webviewManager.webview) {
            return;
        }

        const settings: CodabraSettings = {
            apiKey: vscode.workspace.getConfiguration('codabra').get<string>('apiKey') || '',
            extendedThinking: vscode.workspace.getConfiguration('codabra').get<boolean>('extendedThinking') || false,
            systemPrompt: vscode.workspace.getConfiguration('codabra').get<string>('systemPrompt') || ''
        };

        this._webviewManager.postMessage({
            command: 'loadSettings',
            settings: settings
        });
    }

    /**
     * Saves settings to VSCode configuration
     */
    public async saveSettings(settings: CodabraSettings): Promise<void> {
        // Update API key
        await vscode.workspace.getConfiguration('codabra').update(
            'apiKey',
            settings.apiKey,
            vscode.ConfigurationTarget.Global
        );

        // Update extended thinking setting
        await vscode.workspace.getConfiguration('codabra').update(
            'extendedThinking',
            settings.extendedThinking,
            vscode.ConfigurationTarget.Global
        );

        // Update system prompt
        await vscode.workspace.getConfiguration('codabra').update(
            'systemPrompt',
            settings.systemPrompt,
            vscode.ConfigurationTarget.Global
        );

        // Reinitialize the Anthropic client with the new API key
        this._apiService.initializeAnthropicClient();

        vscode.window.showInformationMessage('Codabra settings saved');
    }

    /**
     * Gets the current settings
     */
    public getSettings(): CodabraSettings {
        return {
            apiKey: vscode.workspace.getConfiguration('codabra').get<string>('apiKey') || '',
            extendedThinking: vscode.workspace.getConfiguration('codabra').get<boolean>('extendedThinking') || false,
            systemPrompt: vscode.workspace.getConfiguration('codabra').get<string>('systemPrompt') || ''
        };
    }
}
