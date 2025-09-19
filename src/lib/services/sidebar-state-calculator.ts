import {
  SidebarState,
  ScreenSize,
  StateChangeSource,
  StateCalculationInput,
  StateCalculationResult,
  NavigationState,
  TypedBreakpoints,
  BreakpointKey
} from '@/types/sidebar'

export namespace SidebarStateCalculator {
  // Type-safe breakpoint configuration
  const BREAKPOINTS: TypedBreakpoints = {
    [BreakpointKey.Mobile]: 768,
    [BreakpointKey.Tablet]: 1024
  } as const


  /**
   * Calculate the correct navigation drawer state based on user intent and screen size
   *
   * This is the core logic that determines:
   * - What state should be displayed
   * - Whether it's a responsive override
   * - Whether the change should be persisted
   */
  export function calculateState(input: StateCalculationInput): StateCalculationResult {
    const { userIntent, screenSize, source } = input

    // Rule 1: Mobile always collapses (responsive override)
    if (screenSize === ScreenSize.Mobile) {
      return {
        currentState: SidebarState.Collapsed,
        isResponsiveOverride: true,
        shouldPersist: false
      }
    }

    // Rule 2: Desktop/Tablet respects user intent
    const resolvedIntent = userIntent ?? SidebarState.Expanded // Default to expanded

    return {
      currentState: resolvedIntent,
      isResponsiveOverride: false,
      shouldPersist: source === StateChangeSource.UserAction
    }
  }

  /**
   * Detect screen size category based on viewport width
   */
  export function detectScreenSize(width: number): ScreenSize {
    if (width < BREAKPOINTS[BreakpointKey.Mobile]) {
      return ScreenSize.Mobile
    } else if (width < BREAKPOINTS[BreakpointKey.Tablet]) {
      return ScreenSize.Tablet
    } else {
      return ScreenSize.Desktop
    }
  }

  /**
   * Determine if a state change should trigger an update
   * Prevents unnecessary re-renders when state hasn't actually changed
   */
  export function shouldTriggerStateChange(
    currentState: NavigationState,
    newInput: StateCalculationInput
  ): boolean {
    const result = calculateState(newInput)

    return (
      currentState.currentState !== result.currentState ||
      currentState.isResponsiveOverride !== result.isResponsiveOverride ||
      currentState.screenSize !== newInput.screenSize
    )
  }

  /**
   * Create the initial navigation state on app startup
   * Handles migration from legacy cookies and sets sensible defaults
   */
  export function createInitialState(
    savedUserIntent: SidebarState | null,
    currentScreenSize: ScreenSize
  ): NavigationState {
    const result = calculateState({
      userIntent: savedUserIntent,
      screenSize: currentScreenSize,
      source: StateChangeSource.SystemInitialization
    })

    return {
      userIntent: savedUserIntent ?? SidebarState.Expanded,
      currentState: result.currentState,
      isResponsiveOverride: result.isResponsiveOverride,
      screenSize: currentScreenSize,
      lastChangeSource: StateChangeSource.SystemInitialization
    }
  }

  /**
   * Handle user-initiated state changes
   * This is called when the user clicks toggle, expand, or collapse
   */
  export function handleUserAction(
    currentState: NavigationState,
    newUserIntent: SidebarState
  ): NavigationState {
    const result = calculateState({
      userIntent: newUserIntent,
      screenSize: currentState.screenSize,
      source: StateChangeSource.UserAction
    })

    return {
      ...currentState,
      userIntent: newUserIntent,
      currentState: result.currentState,
      isResponsiveOverride: result.isResponsiveOverride,
      lastChangeSource: StateChangeSource.UserAction
    }
  }

  /**
   * Handle screen size changes (responsive behavior)
   * Preserves user intent while applying responsive overrides when necessary
   */
  export function handleScreenSizeChange(
    currentState: NavigationState,
    newScreenSize: ScreenSize
  ): NavigationState {
    const result = calculateState({
      userIntent: currentState.userIntent,
      screenSize: newScreenSize,
      source: StateChangeSource.ResponsiveResize
    })

    return {
      ...currentState,
      screenSize: newScreenSize,
      currentState: result.currentState,
      isResponsiveOverride: result.isResponsiveOverride,
      lastChangeSource: StateChangeSource.ResponsiveResize
    }
  }

  /**
   * Handle authentication changes (logout)
   * Resets to default state when user logs out
   */
  export function handleAuthChange(
    currentState: NavigationState,
    isAuthenticated: boolean
  ): NavigationState {
    if (!isAuthenticated) {
      // Reset to default state on logout
      return createInitialState(null, currentState.screenSize)
    }

    // No change if still authenticated
    return currentState
  }

  /**
   * Get the breakpoint values for use in responsive hooks
   */
  export function getBreakpoints(): TypedBreakpoints {
    return BREAKPOINTS
  }
}