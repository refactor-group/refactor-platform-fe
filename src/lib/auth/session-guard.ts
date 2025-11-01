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
 * Session cleanup orchestration: manages logout flow coordination
 * - Handler registered by SessionCleanupProvider on app initialization
 * - Triggered automatically on 401 responses from protected endpoints
 * - Prevents concurrent cleanup attempts via isCleaningUp flag
 */
let sessionCleanupHandler: (() => Promise<void>) | null = null;
let isCleaningUp = false;

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
    // Session invalidation detection: auto-logout on 401 responses
    if (error.response?.status === 401) {
      const isAuthEndpoint = 
        error.config?.url?.includes('/login') || 
        error.config?.url?.includes('/delete');
      
      // Execute cleanup if not auth endpoint and not already cleaning up
      if (!isAuthEndpoint && !isCleaningUp && sessionCleanupHandler) {
        isCleaningUp = true;
        
        try {
          await sessionCleanupHandler();
        } catch (cleanupError) {
          console.error('Session cleanup failed:', cleanupError);
        } finally {
          isCleaningUp = false;
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default sessionGuard;