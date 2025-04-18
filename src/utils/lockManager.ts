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
            clearTimeout(this.lockTimeouts.get(resourceId)!);
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

    /**
     * Executes a function with a lock
     * If the lock can't be acquired, it will retry with exponential backoff
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
        // Try to acquire the lock
        if (this.acquire(resourceId, timeoutMs)) {
            try {
                // Execute the function with a timeout
                const result = await Promise.race([
                    fn(),
                    new Promise<never>((_, reject) => {
                        setTimeout(() => reject(new Error(`Operation timeout for ${resourceId}`)), timeoutMs);
                    })
                ]);
                return result;
            } catch (error) {
                // Re-throw the error after cleanup
                throw error;
            } finally {
                // Always release the lock
                this.release(resourceId);
            }
        } else {
            // If the lock couldn't be acquired, wait and retry with exponential backoff
            const retryDelay = Math.floor(Math.random() * 100) + 50; // 50-150ms initial delay with jitter

            // Wait for the retry delay
            await new Promise(resolve => setTimeout(resolve, retryDelay));

            // Retry the operation
            return this.executeWithLock(resourceId, fn, timeoutMs);
        }
    }

    /**
     * Clears all locks and timeouts
     * Should be called during cleanup/disposal
     */
    public static clearAllLocks(): void {
        // Clear all timeouts
        this.lockTimeouts.forEach(timeout => clearTimeout(timeout));
        this.lockTimeouts.clear();
        this.locks.clear();
    }
}
