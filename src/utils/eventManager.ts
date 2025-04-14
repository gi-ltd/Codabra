import * as vscode from 'vscode';

/**
 * Utility class to manage and optimize event handling
 * Helps prevent redundant event firing and provides debouncing capabilities
 */
export class EventManager {
    private static debounceTimers: Map<string, NodeJS.Timeout> = new Map();

    /**
     * Commands that should be debounced to prevent UI flicker or redundant updates
     */
    public static readonly DEBOUNCE_COMMANDS = ['updateContextUsage', 'updateStreamingContent'];

    /**
     * Debounces an event to prevent multiple rapid firings
     * @param eventId A unique identifier for the event
     * @param callback The function to call after the debounce period
     * @param delay The debounce delay in milliseconds
     */
    public static debounce(eventId: string, callback: () => void, delay: number = 300): void {
        // Clear any existing timer for this event
        if (this.debounceTimers.has(eventId)) {
            clearTimeout(this.debounceTimers.get(eventId));
        }

        // Set a new timer
        const timer = setTimeout(() => {
            callback();
            this.debounceTimers.delete(eventId);
        }, delay);

        // Store the timer
        this.debounceTimers.set(eventId, timer);
    }

    /**
     * Clears all debounce timers
     * Should be called during cleanup/disposal
     */
    public static clearAllDebounceTimers(): void {
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    }

    /**
     * Sets a VSCode context value with debouncing to prevent redundant updates
     * @param key The context key
     * @param value The value to set
     */
    public static setVSCodeContext(key: string, value: any): void {
        const eventId = `vscode-context-${key}`;
        this.debounce(eventId, () => {
            vscode.commands.executeCommand('setContext', key, value);
        }, 50);
    }

    /**
     * Posts a message to a webview with debouncing for specific command types
     * @param webview The webview to post the message to
     * @param message The message to post
     * @param debounceDelay Optional debounce delay (set to 0 to disable debouncing)
     */
    public static postMessageToWebview(
        webview: vscode.Webview | undefined,
        message: any,
        debounceDelay: number = 0
    ): void {
        if (!webview) {
            return;
        }

        if (debounceDelay > 0 && message.command && this.DEBOUNCE_COMMANDS.includes(message.command)) {
            const eventId = `webview-message-${message.command}`;
            this.debounce(eventId, () => {
                webview.postMessage(message);
            }, debounceDelay);
        } else {
            // For other commands or when debouncing is disabled, post immediately
            webview.postMessage(message);
        }
    }
}
