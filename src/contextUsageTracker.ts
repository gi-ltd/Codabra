import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';
import { ResourceManager } from './utils/resourceManager';
import { handleError } from './utils/errorHandler';

/**
 * Interface for context usage information
 */
interface ContextUsageInfo {
    used: number;
    total: number;
}

/**
 * Type guard to check if an object is a valid ContextUsageInfo
 */
function isContextUsageInfo(obj: unknown): obj is ContextUsageInfo {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'used' in obj &&
        'total' in obj &&
        typeof (obj as any).used === 'number' &&
        typeof (obj as any).total === 'number'
    );
}


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
        // Use ResourceManager to ensure proper cleanup
        this._updateIntervalId = ResourceManager.setInterval(() => this.updateContextUsage(), 5000);
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
                if (vscode.env.appHost === 'desktop') {
                    // Safely access the extended environment properties
                    const extendedEnv = vscode.env as any;

                    // Check if contextUsage exists
                    if (extendedEnv.contextUsage) {
                        const contextUsage = extendedEnv.contextUsage;

                        // Validate the contextUsage object
                        if (isContextUsageInfo(contextUsage) && contextUsage.used > 0) {
                            usedTokens = contextUsage.used;
                            total = contextUsage.total || 200000;
                        }
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
            // Use standardized error handling but don't show to user
            handleError(error, 'updating context usage', false);

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
        // ResourceManager will handle clearing the interval
        // This is just an extra safety measure
        if (this._updateIntervalId) {
            clearInterval(this._updateIntervalId);
            this._updateIntervalId = undefined;
        }
    }
}
