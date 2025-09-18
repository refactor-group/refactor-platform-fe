import { describe, it, expect } from 'vitest'
import { NavigationStateCalculator } from '../navigation-state-calculator'
import {
  NavigationDrawerState,
  ScreenSize,
  StateChangeSource,
  NavigationState,
  BreakpointKey
} from '@/types/navigation-drawer'

describe('NavigationStateCalculator', () => {
  describe('calculateState', () => {
    it('should collapse on mobile regardless of user intent', () => {
      const result = NavigationStateCalculator.calculateState({
        userIntent: NavigationDrawerState.Expanded,
        screenSize: ScreenSize.Mobile,
        source: StateChangeSource.UserAction
      })

      expect(result).toEqual({
        currentState: NavigationDrawerState.Collapsed,
        isResponsiveOverride: true,
        shouldPersist: false
      })
    })

    it('should respect user intent on desktop', () => {
      const result = NavigationStateCalculator.calculateState({
        userIntent: NavigationDrawerState.Collapsed,
        screenSize: ScreenSize.Desktop,
        source: StateChangeSource.UserAction
      })

      expect(result).toEqual({
        currentState: NavigationDrawerState.Collapsed,
        isResponsiveOverride: false,
        shouldPersist: true
      })
    })

    it('should respect user intent on tablet', () => {
      const result = NavigationStateCalculator.calculateState({
        userIntent: NavigationDrawerState.Expanded,
        screenSize: ScreenSize.Tablet,
        source: StateChangeSource.UserAction
      })

      expect(result).toEqual({
        currentState: NavigationDrawerState.Expanded,
        isResponsiveOverride: false,
        shouldPersist: true
      })
    })

    it('should default to expanded when no user intent', () => {
      const result = NavigationStateCalculator.calculateState({
        userIntent: null,
        screenSize: ScreenSize.Desktop,
        source: StateChangeSource.SystemInitialization
      })

      expect(result).toEqual({
        currentState: NavigationDrawerState.Expanded,
        isResponsiveOverride: false,
        shouldPersist: false
      })
    })

    it('should not persist non-user actions', () => {
      const result = NavigationStateCalculator.calculateState({
        userIntent: NavigationDrawerState.Expanded,
        screenSize: ScreenSize.Desktop,
        source: StateChangeSource.ResponsiveResize
      })

      expect(result.shouldPersist).toBe(false)
    })
  })

  describe('detectScreenSize', () => {
    it('should detect mobile screen size', () => {
      expect(NavigationStateCalculator.detectScreenSize(400)).toBe(ScreenSize.Mobile)
      expect(NavigationStateCalculator.detectScreenSize(767)).toBe(ScreenSize.Mobile)
    })

    it('should detect tablet screen size', () => {
      expect(NavigationStateCalculator.detectScreenSize(768)).toBe(ScreenSize.Tablet)
      expect(NavigationStateCalculator.detectScreenSize(1023)).toBe(ScreenSize.Tablet)
    })

    it('should detect desktop screen size', () => {
      expect(NavigationStateCalculator.detectScreenSize(1024)).toBe(ScreenSize.Desktop)
      expect(NavigationStateCalculator.detectScreenSize(1920)).toBe(ScreenSize.Desktop)
    })
  })

  describe('shouldTriggerStateChange', () => {
    const mockCurrentState: NavigationState = {
      userIntent: NavigationDrawerState.Expanded,
      currentState: NavigationDrawerState.Expanded,
      isResponsiveOverride: false,
      screenSize: ScreenSize.Desktop,
      lastChangeSource: StateChangeSource.UserAction
    }

    it('should trigger change when display state changes', () => {
      const result = NavigationStateCalculator.shouldTriggerStateChange(
        mockCurrentState,
        {
          userIntent: NavigationDrawerState.Expanded,
          screenSize: ScreenSize.Mobile,
          source: StateChangeSource.ResponsiveResize
        }
      )

      expect(result).toBe(true)
    })

    it('should trigger change when responsive override changes', () => {
      const result = NavigationStateCalculator.shouldTriggerStateChange(
        mockCurrentState,
        {
          userIntent: NavigationDrawerState.Expanded,
          screenSize: ScreenSize.Mobile,
          source: StateChangeSource.ResponsiveResize
        }
      )

      expect(result).toBe(true)
    })

    it('should trigger change when screen size changes', () => {
      const result = NavigationStateCalculator.shouldTriggerStateChange(
        mockCurrentState,
        {
          userIntent: NavigationDrawerState.Expanded,
          screenSize: ScreenSize.Tablet,
          source: StateChangeSource.ResponsiveResize
        }
      )

      expect(result).toBe(true)
    })

    it('should not trigger change when nothing changes', () => {
      const result = NavigationStateCalculator.shouldTriggerStateChange(
        mockCurrentState,
        {
          userIntent: NavigationDrawerState.Expanded,
          screenSize: ScreenSize.Desktop,
          source: StateChangeSource.ResponsiveResize
        }
      )

      expect(result).toBe(false)
    })
  })

  describe('createInitialState', () => {
    it('should create initial state with saved intent', () => {
      const result = NavigationStateCalculator.createInitialState(
        NavigationDrawerState.Collapsed,
        ScreenSize.Desktop
      )

      expect(result).toEqual({
        userIntent: NavigationDrawerState.Collapsed,
        currentState: NavigationDrawerState.Collapsed,
        isResponsiveOverride: false,
        screenSize: ScreenSize.Desktop,
        lastChangeSource: StateChangeSource.SystemInitialization
      })
    })

    it('should create initial state with default intent when none saved', () => {
      const result = NavigationStateCalculator.createInitialState(
        null,
        ScreenSize.Desktop
      )

      expect(result).toEqual({
        userIntent: NavigationDrawerState.Expanded,
        currentState: NavigationDrawerState.Expanded,
        isResponsiveOverride: false,
        screenSize: ScreenSize.Desktop,
        lastChangeSource: StateChangeSource.SystemInitialization
      })
    })

    it('should create initial state with mobile override', () => {
      const result = NavigationStateCalculator.createInitialState(
        NavigationDrawerState.Expanded,
        ScreenSize.Mobile
      )

      expect(result).toEqual({
        userIntent: NavigationDrawerState.Expanded,
        currentState: NavigationDrawerState.Collapsed,
        isResponsiveOverride: true,
        screenSize: ScreenSize.Mobile,
        lastChangeSource: StateChangeSource.SystemInitialization
      })
    })
  })

  describe('handleUserAction', () => {
    const mockCurrentState: NavigationState = {
      userIntent: NavigationDrawerState.Expanded,
      currentState: NavigationDrawerState.Expanded,
      isResponsiveOverride: false,
      screenSize: ScreenSize.Desktop,
      lastChangeSource: StateChangeSource.UserAction
    }

    it('should update user intent and state', () => {
      const result = NavigationStateCalculator.handleUserAction(
        mockCurrentState,
        NavigationDrawerState.Collapsed
      )

      expect(result).toEqual({
        ...mockCurrentState,
        userIntent: NavigationDrawerState.Collapsed,
        currentState: NavigationDrawerState.Collapsed,
        isResponsiveOverride: false,
        lastChangeSource: StateChangeSource.UserAction
      })
    })
  })

  describe('handleScreenSizeChange', () => {
    const mockCurrentState: NavigationState = {
      userIntent: NavigationDrawerState.Expanded,
      currentState: NavigationDrawerState.Expanded,
      isResponsiveOverride: false,
      screenSize: ScreenSize.Desktop,
      lastChangeSource: StateChangeSource.UserAction
    }

    it('should update screen size and apply mobile override', () => {
      const result = NavigationStateCalculator.handleScreenSizeChange(
        mockCurrentState,
        ScreenSize.Mobile
      )

      expect(result).toEqual({
        ...mockCurrentState,
        screenSize: ScreenSize.Mobile,
        currentState: NavigationDrawerState.Collapsed,
        isResponsiveOverride: true,
        lastChangeSource: StateChangeSource.ResponsiveResize
      })
    })

    it('should restore user intent when returning to desktop', () => {
      const mobileState: NavigationState = {
        ...mockCurrentState,
        currentState: NavigationDrawerState.Collapsed,
        isResponsiveOverride: true,
        screenSize: ScreenSize.Mobile
      }

      const result = NavigationStateCalculator.handleScreenSizeChange(
        mobileState,
        ScreenSize.Desktop
      )

      expect(result).toEqual({
        ...mobileState,
        screenSize: ScreenSize.Desktop,
        currentState: NavigationDrawerState.Expanded,
        isResponsiveOverride: false,
        lastChangeSource: StateChangeSource.ResponsiveResize
      })
    })
  })

  describe('handleAuthChange', () => {
    const mockCurrentState: NavigationState = {
      userIntent: NavigationDrawerState.Collapsed,
      currentState: NavigationDrawerState.Collapsed,
      isResponsiveOverride: false,
      screenSize: ScreenSize.Desktop,
      lastChangeSource: StateChangeSource.UserAction
    }

    it('should reset state on logout', () => {
      const result = NavigationStateCalculator.handleAuthChange(
        mockCurrentState,
        false
      )

      expect(result).toEqual({
        userIntent: NavigationDrawerState.Expanded,
        currentState: NavigationDrawerState.Expanded,
        isResponsiveOverride: false,
        screenSize: ScreenSize.Desktop,
        lastChangeSource: StateChangeSource.SystemInitialization
      })
    })

    it('should not change state when still authenticated', () => {
      const result = NavigationStateCalculator.handleAuthChange(
        mockCurrentState,
        true
      )

      expect(result).toBe(mockCurrentState)
    })
  })

  describe('getBreakpoints', () => {
    it('should return correct breakpoint values with enum keys', () => {
      const breakpoints = NavigationStateCalculator.getBreakpoints()

      expect(breakpoints).toEqual({
        mobile: 768,
        tablet: 1024
      })

      // Verify we can access via enum
      expect(breakpoints[BreakpointKey.Mobile]).toBe(768)
      expect(breakpoints[BreakpointKey.Tablet]).toBe(1024)
    })
  })
})