import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';
import { ResourceManager } from './utils/resourceManager';
import { handleError } from './utils/errorHandler';

// Storage key for persisting token usage
const STORAGE_KEY = 'codabra-token-usage';
const DEFAULT_TOTAL_TOKENS = 200000;

/**
 * Manages tracking and updating token usage
 */
export class ContextUsageTracker {
    // Track the last known token usage
    private _lastKnownTokenUsage = 0;
    private _updateIntervalId?: NodeJS.Timeout;
    private _storage: vscode.Memento;

    constructor(
        private readonly _webviewManager: WebviewManager,
        storage?: vscode.Memento
    ) {
        // Use provided storage or fallback to a default empty Memento-like object
        this._storage = storage || {
            get: <T>(key: string, defaultValue?: T) => defaultValue as T,
            update: (key: string, value: any) => Promise.resolve(),
            keys: () => []
        };

        // Load persisted token usage
        this._lastKnownTokenUsage = this._storage.get<number>(STORAGE_KEY, 0);
    }

    /**
     * Initializes the context usage tracker
     */
    public initialize(): void {
        // Update context usage immediately
        this.updateContextUsage();

        // Set up interval to update context usage every 5 seconds
        // Use ResourceManager instead of direct setInterval
        this._updateIntervalId = ResourceManager.setInterval(() => this.updateContextUsage(), 5000);
    }

    /**
     * Updates the context usage display
     */
    public updateContextUsage(used?: number, total: number = DEFAULT_TOTAL_TOKENS): void {
        try {
            // Update token usage if a value is provided
            if (used !== undefined && this._lastKnownTokenUsage !== used) {
                this._lastKnownTokenUsage = used;
                this._storage.update(STORAGE_KEY, used);
            }
            // Otherwise try to get usage from environment
            else if (vscode.env.appHost === 'desktop') {
                const extendedEnv = vscode.env as any;

                if (extendedEnv.contextUsage &&
                    typeof extendedEnv.contextUsage === 'object' &&
                    typeof extendedEnv.contextUsage.used === 'number' &&
                    extendedEnv.contextUsage.used > 0) {

                    // Update if value has changed
                    if (this._lastKnownTokenUsage !== extendedEnv.contextUsage.used) {
                        this._lastKnownTokenUsage = extendedEnv.contextUsage.used;
                        this._storage.update(STORAGE_KEY, this._lastKnownTokenUsage);
                    }

                    // Use environment total if available
                    if (typeof extendedEnv.contextUsage.total === 'number') {
                        total = extendedEnv.contextUsage.total;
                    }
                }
            }

            // Only send update if webview is available
            if (this._webviewManager.webview) {
                // Send context usage update to the webview
                this._webviewManager.postMessage({
                    command: 'updateContextUsage',
                    used: this._lastKnownTokenUsage,
                    total: total
                });
            }
        } catch (error) {
            handleError(error, 'updating context usage', false);
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
