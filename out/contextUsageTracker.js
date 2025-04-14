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
exports.ContextUsageTracker = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Manages tracking and updating token usage
 */
class ContextUsageTracker {
    constructor(_webviewManager) {
        this._webviewManager = _webviewManager;
        // Track the last known token usage
        this._lastKnownTokenUsage = 0;
    }
    /**
     * Initializes the context usage tracker
     */
    initialize() {
        // Update context usage immediately
        this.updateContextUsage();
        // Set up interval to update context usage every 5 seconds
        this._updateIntervalId = setInterval(() => this.updateContextUsage(), 5000);
    }
    /**
     * Updates the context usage display
     */
    updateContextUsage(used, total = 200000) {
        try {
            // If a specific usage value is provided, use it
            if (used !== undefined) {
                this._lastKnownTokenUsage = used;
            }
            else {
                // Otherwise try to get the current context usage from the environment
                let usedTokens = this._lastKnownTokenUsage; // Use the last known token usage as a starting point
                // Try to get context usage from VSCode environment if available
                if (vscode.env.appHost === 'desktop' && vscode.env && vscode.env.contextUsage) {
                    const contextUsage = vscode.env.contextUsage;
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
        }
        catch (error) {
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
    getLastKnownTokenUsage() {
        return this._lastKnownTokenUsage;
    }
    /**
     * Disposes of resources
     */
    dispose() {
        if (this._updateIntervalId) {
            clearInterval(this._updateIntervalId);
            this._updateIntervalId = undefined;
        }
    }
}
exports.ContextUsageTracker = ContextUsageTracker;
//# sourceMappingURL=contextUsageTracker.js.map