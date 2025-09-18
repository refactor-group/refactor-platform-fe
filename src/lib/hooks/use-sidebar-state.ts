import { useState, useEffect, useCallback, useRef } from 'react'
import {
  SidebarState,
  ScreenSize,
  StateChangeSource,
  NavigationState,
  NavigationDrawerContextProps,
  BreakpointKey
} from '@/types/sidebar'
import { SidebarStorage } from '@/lib/services/sidebar-storage'
import { SidebarStateCalculator } from '@/lib/services/sidebar-state-calculator'
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
export function useSidebarState(): NavigationDrawerContextProps {
  const isMobile = useIsMobile()

  // Initialize state from storage and current screen size
  const [navigationState, setNavigationState] = useState<NavigationState>(() => {
    // Try to get saved user intent and migrate legacy data
    const savedIntent = SidebarStorage.migrateLegacyCookieToSessionStorage()
                       ?? SidebarStorage.getUserIntent()

    const currentScreenSize = SidebarStateCalculator.detectScreenSize(
      typeof window !== 'undefined' ? window.innerWidth : 1200
    )

    return SidebarStateCalculator.createInitialState(savedIntent, currentScreenSize)
  })

  // Use ref to access current state in event handlers without re-registering
  const navigationStateRef = useRef(navigationState)
  navigationStateRef.current = navigationState

  // Handle screen size changes with enhanced event typing
  const handleResize = useCallback((event: Event): void => {
    if (!(event.target instanceof Window)) return

    const currentState = navigationStateRef.current
    const newScreenSize = SidebarStateCalculator.detectScreenSize(
      event.target.innerWidth
    )

    if (SidebarStateCalculator.shouldTriggerStateChange(currentState, {
      userIntent: currentState.userIntent,
      screenSize: newScreenSize,
      source: StateChangeSource.ResponsiveResize
    })) {
      setNavigationState(prevState =>
        SidebarStateCalculator.handleScreenSizeChange(prevState, newScreenSize)
      )
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    window.addEventListener('resize', handleResize, {
      signal: controller.signal,
      passive: true
    })

    return () => controller.abort()
  }, [handleResize]) // Include handleResize in dependencies

  // Update screen size when isMobile changes (from useIsMobile hook)
  useEffect(() => {
    const breakpoints = SidebarStateCalculator.getBreakpoints()
    const newScreenSize = isMobile ? ScreenSize.Mobile :
      (window.innerWidth < breakpoints[BreakpointKey.Tablet] ? ScreenSize.Tablet : ScreenSize.Desktop)

    if (newScreenSize !== navigationState.screenSize) {
      setNavigationState(prevState =>
        SidebarStateCalculator.handleScreenSizeChange(prevState, newScreenSize)
      )
    }
  }, [isMobile, navigationState.screenSize])

  // Actions
  const setUserIntent = useCallback((intent: SidebarState, source: StateChangeSource) => {
    setNavigationState(prevState => {
      const newState = SidebarStateCalculator.handleUserAction(prevState, intent)

      // Persist to storage if it's a user action with enhanced error handling
      const result = SidebarStorage.setUserIntent(intent, source)
      if (!result.success) {
        console.warn('Failed to persist navigation drawer state:', result.error.message)
      }

      return newState
    })
  }, [])

  const toggle = useCallback((source: StateChangeSource) => {
    const newIntent = navigationState.userIntent === SidebarState.Expanded
      ? SidebarState.Collapsed
      : SidebarState.Expanded

    setUserIntent(newIntent, source)
  }, [navigationState.userIntent, setUserIntent])

  const expand = useCallback((source: StateChangeSource) => {
    setUserIntent(SidebarState.Expanded, source)
  }, [setUserIntent])

  const collapse = useCallback((source: StateChangeSource) => {
    setUserIntent(SidebarState.Collapsed, source)
  }, [setUserIntent])

  const handleScreenSizeChange = useCallback((newSize: ScreenSize) => {
    setNavigationState(prevState =>
      SidebarStateCalculator.handleScreenSizeChange(prevState, newSize)
    )
  }, [])

  const handleAuthenticationChange = useCallback((isAuthenticated: boolean) => {
    if (!isAuthenticated) {
      SidebarStorage.clearUserIntent()
      setNavigationState(prevState =>
        SidebarStateCalculator.handleAuthChange(prevState, isAuthenticated)
      )
    }
  }, [])

  // Mobile-specific state (for sheet overlay)
  const [openMobile, setOpenMobile] = useState(false)

  // Logout cleanup registration: ensures navigation drawer state is cleared on session end
  useEffect(() => {
    const cleanup = () => {
      // Immediately clear storage
      SidebarStorage.clearUserIntent()

      // Reset navigation state synchronously
      setNavigationState(prevState =>
        SidebarStateCalculator.handleAuthChange(prevState, false)
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