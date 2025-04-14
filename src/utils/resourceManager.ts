import * as vscode from 'vscode';
import { EventManager } from './eventManager';
import { LockManager } from './lockManager';

/**
 * Interface for disposable resources
 */
export interface DisposableResource {
    dispose(): void;
}

/**
 * Utility class to manage resources and ensure proper cleanup
 */
export class ResourceManager {
    private static disposables: DisposableResource[] = [];
    private static intervals: NodeJS.Timeout[] = [];
    private static timeouts: NodeJS.Timeout[] = [];
    private static eventListeners: { target: any; event: string; listener: (...args: any[]) => void }[] = [];

    /**
     * Registers a disposable resource for cleanup
     * @param disposable The disposable resource to register
     * @returns The same disposable for chaining
     */
    public static registerDisposable<T extends DisposableResource>(disposable: T): T {
        this.disposables.push(disposable);
        return disposable;
    }

    /**
     * Registers an interval for cleanup
     * @param interval The interval to register
     * @returns The same interval for chaining
     */
    public static registerInterval(interval: NodeJS.Timeout): NodeJS.Timeout {
        this.intervals.push(interval);
        return interval;
    }

    /**
     * Registers a timeout for cleanup
     * @param timeout The timeout to register
     * @returns The same timeout for chaining
     */
    public static registerTimeout(timeout: NodeJS.Timeout): NodeJS.Timeout {
        this.timeouts.push(timeout);
        return timeout;
    }

    /**
     * Creates and registers an interval
     * @param callback The function to call on each interval
     * @param ms The interval in milliseconds
     * @returns The created interval
     */
    public static setInterval(callback: () => void, ms: number): NodeJS.Timeout {
        const interval = setInterval(callback, ms);
        return this.registerInterval(interval);
    }

    /**
     * Creates and registers a timeout
     * @param callback The function to call after the timeout
     * @param ms The timeout in milliseconds
     * @returns The created timeout
     */
    public static setTimeout(callback: () => void, ms: number): NodeJS.Timeout {
        const timeout = setTimeout(callback, ms);
        return this.registerTimeout(timeout);
    }

    /**
     * Registers an event listener for cleanup
     * @param target The target object to add the listener to
     * @param event The event name
     * @param listener The listener function
     */
    public static addEventListener(
        target: any,
        event: string,
        listener: (...args: any[]) => void
    ): void {
        if (target && typeof target.addEventListener === 'function') {
            target.addEventListener(event, listener);
            this.eventListeners.push({ target, event, listener });
        }
    }

    /**
     * Disposes of all registered resources
     */
    public static disposeAll(): void {
        // Dispose of all disposables
        for (const disposable of this.disposables) {
            try {
                disposable.dispose();
            } catch (error) {
                console.error('Error disposing resource:', error);
            }
        }
        this.disposables = [];

        // Clear all intervals
        for (const interval of this.intervals) {
            clearInterval(interval);
        }
        this.intervals = [];

        // Clear all timeouts
        for (const timeout of this.timeouts) {
            clearTimeout(timeout);
        }
        this.timeouts = [];

        // Remove all event listeners
        for (const { target, event, listener } of this.eventListeners) {
            if (target && typeof target.removeEventListener === 'function') {
                try {
                    target.removeEventListener(event, listener);
                } catch (error) {
                    console.error('Error removing event listener:', error);
                }
            }
        }
        this.eventListeners = [];

        // Clear all event manager debounce timers
        EventManager.clearAllDebounceTimers();

        // Clear all locks
        LockManager.clearAllLocks();
    }
}
