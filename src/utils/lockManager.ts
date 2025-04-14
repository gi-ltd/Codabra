/**
 * Utility class to manage locks for preventing race conditions
 * Provides a simple mutex-like mechanism for asynchronous operations
 */
export class LockManager {
    private static locks: Map<string, boolean> = new Map();
    private static lockTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds default timeout

    /**
     * Acquires a lock for a specific resource
     * @param resourceId A unique identifier for the resource
     * @param timeoutMs Timeout in milliseconds after which the lock is automatically released
     * @returns True if the lock was acquired, false if it was already locked
     */
    public static acquire(resourceId: string, timeoutMs: number = this.DEFAULT_TIMEOUT): boolean {
        // Check if the resource is already locked
        if (this.locks.get(resourceId)) {
            return false;
        }

        // Set the lock
        this.locks.set(resourceId, true);

        // Set a timeout to automatically release the lock
        const timeout = setTimeout(() => {
            this.release(resourceId);
            console.warn(`Lock for ${resourceId} was automatically released after timeout`);
        }, timeoutMs);

        // Store the timeout
        this.lockTimeouts.set(resourceId, timeout);

        return true;
    }

    /**
     * Releases a lock for a specific resource
     * @param resourceId A unique identifier for the resource
     */
    public static release(resourceId: string): void {
        // Clear any timeout
        if (this.lockTimeouts.has(resourceId)) {
            clearTimeout(this.lockTimeouts.get(resourceId));
            this.lockTimeouts.delete(resourceId);
        }

        // Release the lock
        this.locks.set(resourceId, false);
    }

    /**
     * Checks if a resource is currently locked
     * @param resourceId A unique identifier for the resource
     * @returns True if the resource is locked, false otherwise
     */
    public static isLocked(resourceId: string): boolean {
        return !!this.locks.get(resourceId);
    }

    // Queue of pending operations for each resource
    private static pendingOperations: Map<string, Array<{ fn: () => Promise<any>, resolve: (value: any) => void, reject: (reason: any) => void }>> = new Map();

    /**
     * Executes a function with a lock
     * If the lock can't be acquired, the function is queued and will be executed when the lock is released
     * @param resourceId A unique identifier for the resource
     * @param fn The function to execute
     * @param timeoutMs Timeout in milliseconds
     * @returns The result of the function
     */
    public static async executeWithLock<T>(
        resourceId: string,
        fn: () => Promise<T>,
        timeoutMs: number = this.DEFAULT_TIMEOUT
    ): Promise<T> {
        // If the resource is not locked, acquire the lock and execute the function
        if (this.acquire(resourceId, timeoutMs)) {
            try {
                // Execute the function
                return await fn();
            } finally {
                // Always release the lock
                this.release(resourceId);

                // Process any pending operations for this resource
                this.processPendingOperations(resourceId);
            }
        } else {
            // If the lock couldn't be acquired, queue the operation
            return new Promise<T>((resolve, reject) => {
                // Initialize the queue if it doesn't exist
                if (!this.pendingOperations.has(resourceId)) {
                    this.pendingOperations.set(resourceId, []);
                }

                // Add the operation to the queue
                this.pendingOperations.get(resourceId)!.push({ fn, resolve, reject });

                console.log(`Operation queued for ${resourceId}, ${this.pendingOperations.get(resourceId)!.length} operations pending`);
            });
        }
    }

    /**
     * Processes any pending operations for a resource
     * @param resourceId A unique identifier for the resource
     */
    private static processPendingOperations(resourceId: string): void {
        // Check if there are any pending operations
        if (this.pendingOperations.has(resourceId) && this.pendingOperations.get(resourceId)!.length > 0) {
            // Get the next operation
            const nextOperation = this.pendingOperations.get(resourceId)!.shift();

            if (nextOperation) {
                console.log(`Processing next operation for ${resourceId}, ${this.pendingOperations.get(resourceId)!.length} operations remaining`);

                // Execute the operation with a lock
                this.executeWithLock(resourceId, nextOperation.fn)
                    .then(nextOperation.resolve)
                    .catch(nextOperation.reject);
            }
        }
    }

    /**
     * Clears all locks, timeouts, and pending operations
     * Should be called during cleanup/disposal
     */
    public static clearAllLocks(): void {
        // Clear all timeouts
        this.lockTimeouts.forEach(timeout => clearTimeout(timeout));
        this.lockTimeouts.clear();
        this.locks.clear();

        // Clear all pending operations
        this.pendingOperations.clear();
    }
}
