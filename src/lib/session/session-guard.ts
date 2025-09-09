import axios, { AxiosInstance } from 'axios';
import { siteConfig } from '@/site.config';

/**
 * Session-aware HTTP client that automatically handles session invalidation
 * Guards against invalid sessions by triggering cleanup on 401 responses
 */
export const sessionGuard: AxiosInstance = axios.create({
  withCredentials: true,
  timeout: 5000,
  headers: {
    'X-Version': siteConfig.env.backendApiVersion,
  },
});

/**
 * Session cleanup handler - set by SessionCleanupProvider
 * Encapsulates the logout sequence including store resets and navigation
 */
let sessionCleanupHandler: (() => Promise<void>) | null = null;
let isCleaningUp = false;

/**
 * Register the session cleanup handler
 * Called once when SessionCleanupProvider initializes
 */
export function registerSessionCleanup(handler: () => Promise<void>): void {
  sessionCleanupHandler = handler;
}

/**
 * Check if cleanup is currently in progress
 * Prevents multiple simultaneous cleanup attempts
 */
export function isSessionCleanupInProgress(): boolean {
  return isCleaningUp;
}

/**
 * Response interceptor that guards against invalid sessions
 * Automatically triggers cleanup when session becomes invalid (401)
 */
sessionGuard.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Guard against invalid sessions (401 Unauthorized)
    if (error.response?.status === 401) {
      // Skip cleanup for auth endpoints to prevent loops
      const isAuthEndpoint = 
        error.config?.url?.includes('/login') || 
        error.config?.url?.includes('/delete');
      
      if (!isAuthEndpoint && !isCleaningUp && sessionCleanupHandler) {
        isCleaningUp = true;
        console.warn('Session invalidated. Initiating cleanup...');
        
        try {
          await sessionCleanupHandler();
        } catch (cleanupError) {
          console.error('Session cleanup failed:', cleanupError);
        } finally {
          isCleaningUp = false;
        }
      }
    }
    
    // Re-throw error for normal error handling
    return Promise.reject(error);
  }
);

export default sessionGuard;