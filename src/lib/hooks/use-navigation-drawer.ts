import { useState, useEffect, useCallback, useRef } from 'react'
import {
  NavigationDrawerState,
  ScreenSize,
  StateChangeSource,
  NavigationState,
  NavigationDrawerContextProps
} from '@/types/navigation-drawer'
import { NavigationDrawerStorage } from '@/lib/services/navigation-drawer-storage'
import { NavigationStateCalculator } from '@/lib/services/navigation-state-calculator'
import { useIsMobile } from '@/components/hooks/use-mobile'
import { logoutCleanupRegistry } from '@/lib/hooks/logout-cleanup-registry'

/**
 * Enhanced navigation drawer hook with session-only persistence and responsive behavior
 *
 * Features:
 * - Session-only storage (forgotten on tab close/logout)
 * - Smart responsive behavior (auto-collapse on mobile, restore on desktop)
 * - User intent preservation during responsive changes
 * - Type-safe state management with enums
 * - Authentication lifecycle integration
 */
export function useNavigationDrawer(): NavigationDrawerContextProps {
  const isMobile = useIsMobile()

  // Initialize state from storage and current screen size
  const [navigationState, setNavigationState] = useState<NavigationState>(() => {
    // Try to get saved user intent and migrate legacy data
    const savedIntent = NavigationDrawerStorage.migrateLegacyCookieToSessionStorage()
                       ?? NavigationDrawerStorage.getUserIntent()

    const currentScreenSize = NavigationStateCalculator.detectScreenSize(
      typeof window !== 'undefined' ? window.innerWidth : 1200
    )

    return NavigationStateCalculator.createInitialState(savedIntent, currentScreenSize)
  })

  // Use ref to access current state in event handlers without re-registering
  const navigationStateRef = useRef(navigationState)
  navigationStateRef.current = navigationState

  // Handle screen size changes - purely event-driven
  useEffect(() => {
    const handleResize = () => {
      const currentState = navigationStateRef.current
      const newScreenSize = NavigationStateCalculator.detectScreenSize(window.innerWidth)

      if (NavigationStateCalculator.shouldTriggerStateChange(currentState, {
        userIntent: currentState.userIntent,
        screenSize: newScreenSize,
        source: StateChangeSource.ResponsiveResize
      })) {
        setNavigationState(prevState =>
          NavigationStateCalculator.handleScreenSizeChange(prevState, newScreenSize)
        )
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, []) // Empty dependency array - register once

  // Update screen size when isMobile changes (from useIsMobile hook)
  useEffect(() => {
    const newScreenSize = isMobile ? ScreenSize.Mobile :
      (window.innerWidth < NavigationStateCalculator.getBreakpoints().tablet ? ScreenSize.Tablet : ScreenSize.Desktop)

    if (newScreenSize !== navigationState.screenSize) {
      setNavigationState(prevState =>
        NavigationStateCalculator.handleScreenSizeChange(prevState, newScreenSize)
      )
    }
  }, [isMobile, navigationState.screenSize])

  // Actions
  const setUserIntent = useCallback((intent: NavigationDrawerState, source: StateChangeSource) => {
    setNavigationState(prevState => {
      const newState = NavigationStateCalculator.handleUserAction(prevState, intent)

      // Persist to storage if it's a user action
      NavigationDrawerStorage.setUserIntent(intent, source)

      return newState
    })
  }, [])

  const toggle = useCallback((source: StateChangeSource) => {
    const newIntent = navigationState.userIntent === NavigationDrawerState.Expanded
      ? NavigationDrawerState.Collapsed
      : NavigationDrawerState.Expanded

    setUserIntent(newIntent, source)
  }, [navigationState.userIntent, setUserIntent])

  const expand = useCallback((source: StateChangeSource) => {
    setUserIntent(NavigationDrawerState.Expanded, source)
  }, [setUserIntent])

  const collapse = useCallback((source: StateChangeSource) => {
    setUserIntent(NavigationDrawerState.Collapsed, source)
  }, [setUserIntent])

  const handleScreenSizeChange = useCallback((newSize: ScreenSize) => {
    setNavigationState(prevState =>
      NavigationStateCalculator.handleScreenSizeChange(prevState, newSize)
    )
  }, [])

  const handleAuthenticationChange = useCallback((isAuthenticated: boolean) => {
    if (!isAuthenticated) {
      NavigationDrawerStorage.clearUserIntent()
      setNavigationState(prevState =>
        NavigationStateCalculator.handleAuthChange(prevState, isAuthenticated)
      )
    }
  }, [])

  // Mobile-specific state (for sheet overlay)
  const [openMobile, setOpenMobile] = useState(false)

  // Logout cleanup registration: ensures navigation drawer state is cleared on session end
  useEffect(() => {
    const cleanup = () => {
      // Immediately clear storage
      NavigationDrawerStorage.clearUserIntent()

      // Reset navigation state synchronously
      setNavigationState(prevState =>
        NavigationStateCalculator.handleAuthChange(prevState, false)
      )
    }

    const unregisterCleanup = logoutCleanupRegistry.register(cleanup)

    return () => {
      unregisterCleanup()
    }
  }, [])

  return {
    // Core state
    state: navigationState.currentState,
    userIntent: navigationState.userIntent,
    isResponsiveOverride: navigationState.isResponsiveOverride,

    // Screen size awareness
    screenSize: navigationState.screenSize,
    isMobile,

    // Actions
    setUserIntent,
    toggle,
    expand,
    collapse,

    // Mobile-specific
    openMobile,
    setOpenMobile,

    // Internal handlers
    handleScreenSizeChange,
    handleAuthenticationChange
  }
}