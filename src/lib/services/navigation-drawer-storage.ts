import { NavigationDrawerState, StateChangeSource } from '@/types/navigation-drawer'

export namespace NavigationDrawerStorage {
  const STORAGE_KEY = 'nav_drawer_user_intent'
  const LEGACY_COOKIE_NAME = 'sidebar_state'

  /**
   * Get the user's explicit preference from sessionStorage
   * Returns null if no preference is stored or if stored value is invalid
   */
  export function getUserIntent(): NavigationDrawerState | null {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored && isValidState(stored)) {
        return stored as NavigationDrawerState
      }
      return null
    } catch {
      // Handle cases where sessionStorage is not available (e.g., private browsing)
      return null
    }
  }

  /**
   * Set the user's explicit preference
   * Only persists user-initiated changes, ignores system/responsive changes
   * @param intent The navigation drawer state to store
   * @param source The source of the state change
   * @returns True if successfully stored, false otherwise
   */
  export function setUserIntent(
    intent: NavigationDrawerState,
    source: StateChangeSource
  ): boolean {
    // Only persist user-initiated changes
    if (source !== StateChangeSource.UserAction) {
      return false
    }

    try {
      sessionStorage.setItem(STORAGE_KEY, intent)
      return true
    } catch {
      // Handle cases where storage is full or unavailable
      return false
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
   * Check if a value is a valid NavigationDrawerState
   */
  export function isValidState(value: unknown): value is NavigationDrawerState {
    return typeof value === 'string' &&
           Object.values(NavigationDrawerState).includes(value as NavigationDrawerState)
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