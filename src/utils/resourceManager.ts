import { EventManager } from './eventManager';
import { LockManager } from './lockManager';

/**
 * Interface for disposable resources
 */
export interface DisposableResource {
    dispose(): void;
}

/**
 * Type for any resource that needs to be tracked and cleaned up
 */
type Resource = DisposableResource | NodeJS.Timeout | {
    target: any;
    event: string;
    listener: (...args: any[]) => void;
};

/**
 * Utility class to manage resources and ensure proper cleanup
 */
export class ResourceManager {
    // Single array to track all resources
    private static resources: Resource[] = [];

    // Optional grouping of resources
    private static resourceGroups: Map<string, Resource[]> = new Map();

    // Flag to prevent reentrant disposal
    private static isDisposing = false;

    /**
     * Registers a disposable resource for cleanup
     * @param disposable The disposable resource to register
     * @param groupId Optional group ID to organize resources
     * @returns The same disposable for chaining
     */
    public static registerDisposable<T extends DisposableResource>(disposable: T, groupId?: string): T {
        if (!disposable) {
            console.warn('Attempted to register a null or undefined disposable');
            return disposable;
        }

        this.resources.push(disposable);

        if (groupId) {
            this.addToGroup(groupId, disposable);
        }

        return disposable;
    }

    /**
     * Creates and registers an interval
     * @param callback The function to call on each interval
     * @param ms The interval in milliseconds
     * @returns The created interval
     */
    public static setInterval(callback: () => void, ms: number, groupId?: string): NodeJS.Timeout {
        const interval = setInterval(callback, ms);
        this.resources.push(interval);

        if (groupId) {
            this.addToGroup(groupId, interval);
        }

        return interval;
    }

    /**
     * Creates and registers a timeout
     * @param callback The function to call after the timeout
     * @param ms The timeout in milliseconds
     * @returns The created timeout
     */
    public static setTimeout(callback: () => void, ms: number, groupId?: string): NodeJS.Timeout {
        const timeout = setTimeout(callback, ms);
        this.resources.push(timeout);

        if (groupId) {
            this.addToGroup(groupId, timeout);
        }

        return timeout;
    }

    /**
     * Registers an event listener for cleanup
     * @param target The target object to add the listener to
     * @param event The event name
     * @param listener The listener function
     * @param groupId Optional group ID
     */
    public static addEventListener(
        target: any,
        event: string,
        listener: (...args: any[]) => void,
        groupId?: string
    ): void {
        if (target && typeof target.addEventListener === 'function') {
            target.addEventListener(event, listener);

            const eventResource = { target, event, listener };
            this.resources.push(eventResource);

            if (groupId) {
                this.addToGroup(groupId, eventResource);
            }
        }
    }

    /**
     * Helper method to add a resource to a group
     */
    private static addToGroup(groupId: string, resource: Resource): void {
        if (!this.resourceGroups.has(groupId)) {
            this.resourceGroups.set(groupId, []);
        }
        this.resourceGroups.get(groupId)!.push(resource);
    }

    /**
     * Disposes resources in a specific group
     * @param groupId The group ID to dispose
     */
    public static disposeGroup(groupId: string): void {
        if (!this.resourceGroups.has(groupId)) {
            return;
        }

        const resources = this.resourceGroups.get(groupId)!;

        // Dispose each resource in the group
        for (const resource of resources) {
            try {
                this.disposeResource(resource);

                // Remove from main resources array
                const index = this.resources.indexOf(resource);
                if (index !== -1) {
                    this.resources.splice(index, 1);
                }
            } catch (error) {
                console.error(`Error disposing resource in group ${groupId}:`, error);
            }
        }

        // Clear the group
        this.resourceGroups.delete(groupId);
    }

    /**
     * Helper method to dispose a single resource
     */
    private static disposeResource(resource: Resource): void {
        if (!resource) return;

        try {
            // Handle disposable resources
            if ('dispose' in resource && typeof resource.dispose === 'function') {
                resource.dispose();
            }
            // Handle timeouts and intervals
            else if (typeof resource === 'number') {
                clearTimeout(resource);
                clearInterval(resource);
            }
            // Handle event listeners
            else if ('target' in resource && 'event' in resource && 'listener' in resource) {
                const eventResource = resource as { target: any; event: string; listener: (...args: any[]) => void };
                if (eventResource.target && typeof eventResource.target.removeEventListener === 'function') {
                    eventResource.target.removeEventListener(eventResource.event, eventResource.listener);
                }
            }
        } catch (error) {
            console.error('Error disposing resource:', error);
        }
    }

    /**
     * Disposes of all registered resources
     */
    public static disposeAll(): void {
        // Prevent reentrant calls
        if (this.isDisposing) {
            console.warn('Resource disposal already in progress, skipping redundant call');
            return;
        }

        this.isDisposing = true;

        try {
            // Create a copy of the resources array to avoid modification during iteration
            const resourcesToDispose = [...this.resources];

            // Clear arrays first to prevent any new additions during disposal
            this.resources = [];
            this.resourceGroups.clear();

            // Dispose all resources
            for (const resource of resourcesToDispose) {
                this.disposeResource(resource);
            }

            // Clear all event manager debounce timers
            EventManager.clearAllDebounceTimers();

            // Clear all locks
            LockManager.clearAllLocks();

            console.log('All resources successfully disposed');
        } catch (error) {
            console.error('Unexpected error during resource disposal:', error);
        } finally {
            this.isDisposing = false;
        }
    }
}
