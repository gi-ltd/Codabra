import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';

/**
 * Manages tracking and updating token usage
 */
export class ContextUsageTracker {
    // Track the last known token usage
    private _lastKnownTokenUsage = 0;
    private _updateIntervalId?: NodeJS.Timeout;

    constructor(
        private readonly _webviewManager: WebviewManager
    ) { }

    /**
     * Initializes the context usage tracker
     */
    public initialize(): void {
        // Update context usage immediately
        this.updateContextUsage();

        // Set up interval to update context usage every 5 seconds
        this._updateIntervalId = setInterval(() => this.updateContextUsage(), 5000);
    }

    /**
     * Updates the context usage display
     */
    public updateContextUsage(used?: number, total: number = 200000): void {
        try {
            // If a specific usage value is provided, use it
            if (used !== undefined) {
                this._lastKnownTokenUsage = used;
            } else {
                // Otherwise try to get the current context usage from the environment
                let usedTokens = this._lastKnownTokenUsage; // Use the last known token usage as a starting point

                // Try to get context usage from VSCode environment if available
                if (vscode.env.appHost === 'desktop' && (vscode as any).env && (vscode as any).env.contextUsage) {
                    const contextUsage = (vscode as any).env.contextUsage;
                    if (contextUsage && contextUsage.used > 0) { // Only update if we get a positive value
                        usedTokens = contextUsage.used;
                        total = contextUsage.total || 200000;
                    }
                }

                // Update the last known token usage
                this._lastKnownTokenUsage = usedTokens;
            }

            // Send context usage update to the webview
            this._webviewManager.postMessage({
                command: 'updateContextUsage',
                used: this._lastKnownTokenUsage,
                total: total
            });
        } catch (error) {
            console.error('Error updating context usage:', error);

            // Fallback to the last known token usage if there's an error
            this._webviewManager.postMessage({
                command: 'updateContextUsage',
                used: this._lastKnownTokenUsage,
                total: 200000
            });
        }
    }

    /**
     * Gets the last known token usage
     */
    public getLastKnownTokenUsage(): number {
        return this._lastKnownTokenUsage;
    }

    /**
     * Disposes of resources
     */
    public dispose(): void {
        if (this._updateIntervalId) {
            clearInterval(this._updateIntervalId);
            this._updateIntervalId = undefined;
        }
    }
}
