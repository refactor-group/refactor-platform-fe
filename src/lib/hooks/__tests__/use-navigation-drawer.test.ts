import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNavigationDrawer } from '../use-navigation-drawer'
import { NavigationDrawerState, StateChangeSource, ScreenSize } from '@/types/navigation-drawer'
import { NavigationDrawerStorage } from '@/lib/services/navigation-drawer-storage'
import { logoutCleanupRegistry } from '@/lib/hooks/logout-cleanup-registry'

// Mock the storage service
vi.mock('@/lib/services/navigation-drawer-storage', () => ({
  NavigationDrawerStorage: {
    migrateLegacyCookieToSessionStorage: vi.fn(() => null),
    getUserIntent: vi.fn(() => null),
    setUserIntent: vi.fn(),
    clearUserIntent: vi.fn()
  }
}))

// Mock the mobile hook
vi.mock('@/components/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false)
}))

// Mock the logout cleanup registry
vi.mock('@/lib/hooks/logout-cleanup-registry', () => ({
  logoutCleanupRegistry: {
    register: vi.fn(() => vi.fn()), // Returns unregister function
  }
}))

// Mock window.innerWidth
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1200
})

// Mock addEventListener/removeEventListener
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()
Object.defineProperty(window, 'addEventListener', { value: mockAddEventListener })
Object.defineProperty(window, 'removeEventListener', { value: mockRemoveEventListener })

describe('useNavigationDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.innerWidth = 1200
  })

  it('should initialize with default expanded state on desktop', () => {
    const { result } = renderHook(() => useNavigationDrawer())

    expect(result.current.state).toBe(NavigationDrawerState.Expanded)
    expect(result.current.userIntent).toBe(NavigationDrawerState.Expanded)
    expect(result.current.isResponsiveOverride).toBe(false)
    expect(result.current.screenSize).toBe(ScreenSize.Desktop)
  })

  it('should register resize event listener on mount', () => {
    renderHook(() => useNavigationDrawer())

    expect(mockAddEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('should cleanup resize event listener on unmount', () => {
    const { unmount } = renderHook(() => useNavigationDrawer())

    unmount()

    expect(mockRemoveEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('should toggle state correctly', () => {
    const { result } = renderHook(() => useNavigationDrawer())

    act(() => {
      result.current.toggle(StateChangeSource.UserAction)
    })

    expect(result.current.state).toBe(NavigationDrawerState.Collapsed)
    expect(result.current.userIntent).toBe(NavigationDrawerState.Collapsed)
  })

  it('should expand state correctly', () => {
    const { result } = renderHook(() => useNavigationDrawer())

    // First collapse it
    act(() => {
      result.current.collapse(StateChangeSource.UserAction)
    })

    // Then expand it
    act(() => {
      result.current.expand(StateChangeSource.UserAction)
    })

    expect(result.current.state).toBe(NavigationDrawerState.Expanded)
    expect(result.current.userIntent).toBe(NavigationDrawerState.Expanded)
  })

  it('should collapse state correctly', () => {
    const { result } = renderHook(() => useNavigationDrawer())

    act(() => {
      result.current.collapse(StateChangeSource.UserAction)
    })

    expect(result.current.state).toBe(NavigationDrawerState.Collapsed)
    expect(result.current.userIntent).toBe(NavigationDrawerState.Collapsed)
  })

  it('should handle mobile state correctly', () => {
    const { result } = renderHook(() => useNavigationDrawer())

    act(() => {
      result.current.setOpenMobile(true)
    })

    expect(result.current.openMobile).toBe(true)

    act(() => {
      result.current.setOpenMobile(false)
    })

    expect(result.current.openMobile).toBe(false)
  })

  it('should provide screen size information', () => {
    const { result } = renderHook(() => useNavigationDrawer())

    expect(result.current.screenSize).toBe(ScreenSize.Desktop)
    expect(result.current.isMobile).toBe(false)
  })

  it('should handle authentication changes', () => {
    const { result } = renderHook(() => useNavigationDrawer())

    // Set to collapsed first
    act(() => {
      result.current.collapse(StateChangeSource.UserAction)
    })

    // Simulate logout
    act(() => {
      result.current.handleAuthenticationChange(false)
    })

    expect(result.current.state).toBe(NavigationDrawerState.Expanded)
    expect(result.current.userIntent).toBe(NavigationDrawerState.Expanded)
  })

  it('should register logout cleanup function on mount', () => {
    renderHook(() => useNavigationDrawer())

    expect(logoutCleanupRegistry.register).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should clear storage and reset state when logout cleanup is executed', () => {
    renderHook(() => useNavigationDrawer())

    // Get the cleanup function that was registered
    const cleanupFunction = vi.mocked(logoutCleanupRegistry.register).mock.calls[0][0]

    // Execute the cleanup function (simulating logout)
    act(() => {
      cleanupFunction()
    })

    expect(NavigationDrawerStorage.clearUserIntent).toHaveBeenCalled()
  })
})