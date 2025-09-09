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
   * Execute all registered cleanup functions
   * Called by the logout process
   */
  async executeAll(): Promise<void> {
    console.warn(`🧹 [LOGOUT-CLEANUP] Executing ${this.cleanupFunctions.size} cleanup functions`);
    
    const cleanupPromises = Array.from(this.cleanupFunctions).map(async (cleanup, index) => {
      try {
        console.warn(`🧹 [LOGOUT-CLEANUP] Executing cleanup function ${index + 1}`);
        await cleanup();
        console.warn(`✅ [LOGOUT-CLEANUP] Cleanup function ${index + 1} completed`);
      } catch (error) {
        console.error(`❌ [LOGOUT-CLEANUP] Cleanup function ${index + 1} failed:`, error);
        // Don't throw - continue with other cleanups
      }
    });

    await Promise.allSettled(cleanupPromises);
    console.warn('✅ [LOGOUT-CLEANUP] All cleanup functions completed');
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