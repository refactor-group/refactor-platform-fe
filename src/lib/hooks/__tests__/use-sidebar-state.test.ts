import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSidebarState } from '../use-sidebar-state'
import { SidebarState, StateChangeSource, ScreenSize } from '@/types/sidebar'
import { SidebarStorage } from '@/lib/services/sidebar-storage'

// Capture the cleanup function passed to useLogoutCleanup
let capturedCleanupFn: (() => void) | null = null

// Mock the storage service
vi.mock('@/lib/services/sidebar-storage', () => ({
  SidebarStorage: {
    migrateLegacyCookieToSessionStorage: vi.fn(() => null),
    getUserIntent: vi.fn(() => null),
    setUserIntent: vi.fn(() => ({ success: true, data: true })),
    clearUserIntent: vi.fn()
  }
}))

// Mock the mobile hook
vi.mock('@/components/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false)
}))

// Mock the logout cleanup hook
vi.mock('@/lib/hooks/use-logout-cleanup', () => ({
  useLogoutCleanup: vi.fn((cleanup: () => void) => {
    capturedCleanupFn = cleanup
  })
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

describe('useSidebarState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.innerWidth = 1200
    capturedCleanupFn = null
  })

  it('should initialize with default expanded state on desktop', () => {
    const { result } = renderHook(() => useSidebarState())

    expect(result.current.state).toBe(SidebarState.Expanded)
    expect(result.current.userIntent).toBe(SidebarState.Expanded)
    expect(result.current.isResponsiveOverride).toBe(false)
    expect(result.current.screenSize).toBe(ScreenSize.Desktop)
  })

  it('should register resize event listener on mount', () => {
    renderHook(() => useSidebarState())

    expect(mockAddEventListener).toHaveBeenCalledWith('resize', expect.any(Function), {
      signal: expect.any(AbortSignal),
      passive: true
    })
  })

  it('should cleanup resize event listener on unmount', () => {
    const { unmount } = renderHook(() => useSidebarState())

    unmount()

    // With AbortController, we don't call removeEventListener directly
    // Instead, we abort the controller which cleans up all listeners
    expect(mockAddEventListener).toHaveBeenCalled()
  })

  it('should toggle state correctly', () => {
    const { result } = renderHook(() => useSidebarState())

    act(() => {
      result.current.toggle(StateChangeSource.UserAction)
    })

    expect(result.current.state).toBe(SidebarState.Collapsed)
    expect(result.current.userIntent).toBe(SidebarState.Collapsed)
  })

  it('should expand state correctly', () => {
    const { result } = renderHook(() => useSidebarState())

    // First collapse it
    act(() => {
      result.current.collapse(StateChangeSource.UserAction)
    })

    // Then expand it
    act(() => {
      result.current.expand(StateChangeSource.UserAction)
    })

    expect(result.current.state).toBe(SidebarState.Expanded)
    expect(result.current.userIntent).toBe(SidebarState.Expanded)
  })

  it('should collapse state correctly', () => {
    const { result } = renderHook(() => useSidebarState())

    act(() => {
      result.current.collapse(StateChangeSource.UserAction)
    })

    expect(result.current.state).toBe(SidebarState.Collapsed)
    expect(result.current.userIntent).toBe(SidebarState.Collapsed)
  })

  it('should handle mobile state correctly', () => {
    const { result } = renderHook(() => useSidebarState())

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
    const { result } = renderHook(() => useSidebarState())

    expect(result.current.screenSize).toBe(ScreenSize.Desktop)
    expect(result.current.isMobile).toBe(false)
  })

  it('should handle authentication changes', () => {
    const { result } = renderHook(() => useSidebarState())

    // Set to collapsed first
    act(() => {
      result.current.collapse(StateChangeSource.UserAction)
    })

    // Simulate logout
    act(() => {
      result.current.handleAuthenticationChange(false)
    })

    expect(result.current.state).toBe(SidebarState.Expanded)
    expect(result.current.userIntent).toBe(SidebarState.Expanded)
  })

  it('should register logout cleanup function on mount', async () => {
    const { useLogoutCleanup } = await import('@/lib/hooks/use-logout-cleanup')

    renderHook(() => useSidebarState())

    expect(useLogoutCleanup).toHaveBeenCalledWith(expect.any(Function))
  })

  it('should clear storage and reset state when logout cleanup is executed', () => {
    renderHook(() => useSidebarState())

    // Execute the cleanup function that was captured by the mock
    expect(capturedCleanupFn).not.toBeNull()
    act(() => {
      capturedCleanupFn!()
    })

    expect(SidebarStorage.clearUserIntent).toHaveBeenCalled()
  })
})