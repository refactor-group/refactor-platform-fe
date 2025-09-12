/**
 * Registry for components to register cleanup functions that should run during logout
 * This ensures cleanup happens synchronously during the logout sequence
 */

type CleanupFunction = () => void | Promise<void>;

class LogoutCleanupRegistry {
  private cleanupFunctions: Set<CleanupFunction> = new Set();

  /**
   * Register a cleanup function to be called during logout
   */
  register(cleanup: CleanupFunction): () => void {
    this.cleanupFunctions.add(cleanup);
    
    // Return unregister function
    return () => {
      this.cleanupFunctions.delete(cleanup);
    };
  }

  /**
   * Execute all registered cleanup functions during logout
   * Ensures graceful component teardown with error isolation
   */
  async executeAll(): Promise<void> {
    const cleanupPromises = Array.from(this.cleanupFunctions).map(async (cleanup, index) => {
      try {
        await cleanup();
      } catch (error) {
        console.error(`Cleanup function ${index + 1} failed:`, error);
      }
    });

    await Promise.allSettled(cleanupPromises);
  }

  /**
   * Get the number of registered cleanup functions (for debugging)
   */
  get size(): number {
    return this.cleanupFunctions.size;
  }
}

// Global singleton instance
export const logoutCleanupRegistry = new LogoutCleanupRegistry();