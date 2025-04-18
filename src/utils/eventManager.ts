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
            clearTimeout(this.debounceTimers.get(eventId)!);
        }

        // Set a new timer and store it
        this.debounceTimers.set(eventId, setTimeout(() => {
            callback();
            this.debounceTimers.delete(eventId);
        }, delay));
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
        this.debounce(`vscode-context-${key}`, () => {
            vscode.commands.executeCommand('setContext', key, value);
        }, 50);
    }

    /**
     * Posts a message to a webview with optional debouncing
     * @param webview The webview to post the message to
     * @param message The message to post
     */
    public static postMessageToWebview(webview: vscode.Webview | undefined, message: any): void {
        if (!webview) return;

        // Automatically debounce specific commands
        if (message.command && this.DEBOUNCE_COMMANDS.includes(message.command)) {
            this.debounce(`webview-message-${message.command}`, () => {
                webview.postMessage(message);
            }, 100);
        } else {
            // For other commands, post immediately
            webview.postMessage(message);
        }
    }
}
