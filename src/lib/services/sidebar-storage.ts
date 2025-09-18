import {
  NavigationDrawerState,
  StateChangeSource,
  StorageUnavailableError,
  Result,
  createStorageKey
} from '@/types/sidebar'

export namespace SidebarStorage {
  const STORAGE_KEY = createStorageKey('user_intent')
  const LEGACY_COOKIE_NAME = 'sidebar_state'

  // Type predicates for validation
  const VALID_STATES = Object.values(NavigationDrawerState)

  export function isValidState(value: unknown): value is NavigationDrawerState {
    return typeof value === 'string' &&
           (VALID_STATES as readonly string[]).includes(value)
  }

  export function parseStoredState(value: string | null): NavigationDrawerState | null {
    if (!value) return null

    if (isValidState(value)) {
      return value
    }

    // Log warning for debugging
    console.warn(`Invalid navigation drawer state: ${value}`)
    return null
  }

  /**
   * Get the user's explicit preference from sessionStorage
   * Returns null if no preference is stored or if stored value is invalid
   */
  export function getUserIntent(): NavigationDrawerState | null {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      return parseStoredState(stored)
    } catch {
      // Handle cases where sessionStorage is not available (e.g., private browsing)
      return null
    }
  }

  /**
   * Set the user's explicit preference with enhanced error handling
   * Only persists user-initiated changes, ignores system/responsive changes
   * @param intent The navigation drawer state to store
   * @param source The source of the state change
   * @returns Result indicating success or failure with specific error
   */
  export function setUserIntent(
    intent: NavigationDrawerState,
    source: StateChangeSource
  ): Result<boolean, StorageUnavailableError> {
    // Only persist user-initiated changes
    if (source !== StateChangeSource.UserAction) {
      return { success: true, data: false }
    }

    try {
      sessionStorage.setItem(STORAGE_KEY, intent)
      return { success: true, data: true }
    } catch {
      return { success: false, error: new StorageUnavailableError() }
    }
  }

  /**
   * Clear the user's preference (called on logout or session end)
   */
  export function clearUserIntent(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Silent fail - storage might not be available
    }
  }


  /**
   * Check if sessionStorage is available and working
   */
  export function isStorageAvailable(): boolean {
    try {
      const testKey = '__nav_storage_test__'
      sessionStorage.setItem(testKey, 'test')
      sessionStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }

  /**
   * Migrate existing cookie data to sessionStorage with enum types
   * This ensures a smooth transition for existing users
   */
  export function migrateLegacyCookieToSessionStorage(): NavigationDrawerState | null {
    try {
      // Check if we already have new enum-based storage
      const existing = getUserIntent()
      if (existing !== null) {
        return existing
      }

      // Look for legacy cookie
      const legacyValue = getLegacyCookieValue()
      if (legacyValue) {
        // Convert legacy boolean cookie to enum
        const migratedState = legacyValue === 'true'
          ? NavigationDrawerState.Expanded
          : NavigationDrawerState.Collapsed

        // Clear legacy cookie
        clearLegacyCookie()

        return migratedState
      }

      return null
    } catch {
      return null
    }
  }

  function getLegacyCookieValue(): string | null {
    try {
      const cookies = document.cookie.split(';')
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=')
        if (name === LEGACY_COOKIE_NAME) {
          return value
        }
      }
      return null
    } catch {
      return null
    }
  }

  function clearLegacyCookie(): void {
    try {
      document.cookie = `${LEGACY_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
    } catch {
      // Silent fail
    }
  }
}