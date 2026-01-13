import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSSEConnection } from '@/lib/hooks/use-sse-connection'
import { createSSEConnectionStore, SSEConnectionState } from '@/lib/stores/sse-connection-store'
import { SSEConnectionStoreContext } from '@/lib/contexts/sse-connection-context'
import { sources } from 'eventsourcemock'
import { siteConfig } from '@/site.config'

// Helper to create test wrapper with store
function createWrapper() {
  const store = createSSEConnectionStore()
  return {
    wrapper: function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <SSEConnectionStoreContext.Provider value={store}>
          {children}
        </SSEConnectionStoreContext.Provider>
      )
    },
    store
  }
}

describe('useSSEConnection - Lifecycle', () => {
  const SSE_URL = `${siteConfig.env.backendServiceURL}/sse`

  beforeEach(() => {
    // Clear all sources before each test
    Object.keys(sources).forEach(key => delete sources[key])
  })

  afterEach(() => {
    // Close all open sources to prevent leaks between tests
    Object.values(sources).forEach((source: any) => {
      if (source.readyState !== 2) { // 2 = CLOSED
        source.close()
      }
    })
  })

  it('should create EventSource when isLoggedIn=true', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(
      () => useSSEConnection(true),
      { wrapper }
    )

    // Verify EventSource was created
    expect(sources[SSE_URL]).toBeDefined()
    expect(result.current).toBe(sources[SSE_URL])
    expect(result.current).not.toBeNull()
  })

  it('should NOT create EventSource when isLoggedIn=false', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(
      () => useSSEConnection(false),
      { wrapper }
    )

    expect(sources[SSE_URL]).toBeUndefined()
    expect(result.current).toBeNull()
  })

  it('should maintain single instance across re-renders', () => {
    const { wrapper } = createWrapper()
    const { result, rerender } = renderHook(
      ({ isLoggedIn }) => useSSEConnection(isLoggedIn),
      {
        wrapper,
        initialProps: { isLoggedIn: true }
      }
    )

    const firstInstance = result.current

    // Re-render with same prop
    rerender({ isLoggedIn: true })

    // Should be the SAME instance (referential equality)
    expect(result.current).toBe(firstInstance)
    expect(sources[SSE_URL]).toBe(firstInstance)
  })

  it('should close EventSource when isLoggedIn changes from true to false', async () => {
    const { wrapper } = createWrapper()
    const { result, rerender } = renderHook(
      ({ isLoggedIn }) => useSSEConnection(isLoggedIn),
      {
        wrapper,
        initialProps: { isLoggedIn: true }
      }
    )

    const firstInstance = result.current
    expect(firstInstance).toBe(sources[SSE_URL])
    expect(firstInstance!.readyState).toBe(0) // 0 = CONNECTING

    // Logout
    rerender({ isLoggedIn: false })

    await waitFor(() => {
      expect(firstInstance!.readyState).toBe(2) // 2 = CLOSED
      expect(result.current).toBeNull()
    })
  })

  it('should create new EventSource instance when isLoggedIn changes from false to true', async () => {
    const { wrapper } = createWrapper()
    const { result, rerender } = renderHook(
      ({ isLoggedIn }) => useSSEConnection(isLoggedIn),
      {
        wrapper,
        initialProps: { isLoggedIn: false }
      }
    )

    expect(result.current).toBeNull()
    expect(sources[SSE_URL]).toBeUndefined()

    // Login
    rerender({ isLoggedIn: true })

    await waitFor(() => {
      expect(result.current).toBe(sources[SSE_URL])
      expect(sources[SSE_URL]).toBeDefined()
    })
  })

  it('should close and recreate EventSource when logging out and back in', async () => {
    const { wrapper } = createWrapper()
    const { result, rerender } = renderHook(
      ({ isLoggedIn }) => useSSEConnection(isLoggedIn),
      {
        wrapper,
        initialProps: { isLoggedIn: true }
      }
    )

    const firstInstance = result.current
    expect(firstInstance).toBe(sources[SSE_URL])

    // Logout
    rerender({ isLoggedIn: false })

    await waitFor(() => {
      expect(firstInstance!.readyState).toBe(2) // 2 = CLOSED
      expect(result.current).toBeNull()
    })

    // Clear the closed source from sources object
    delete sources[SSE_URL]

    // Login again
    rerender({ isLoggedIn: true })

    await waitFor(() => {
      const secondInstance = result.current
      expect(secondInstance).toBe(sources[SSE_URL])
      expect(secondInstance).not.toBe(firstInstance) // NEW instance, not reused
    })
  })

  it('should set Connecting state when connection is created', async () => {
    const { wrapper, store } = createWrapper()

    renderHook(() => useSSEConnection(true), { wrapper })

    await waitFor(() => {
      expect(store.getState().state).toBe(SSEConnectionState.Connecting)
    })
  })

  it('should call onopen handler and transition to Connected state', async () => {
    const { wrapper, store } = createWrapper()
    renderHook(
      () => useSSEConnection(true),
      { wrapper }
    )

    const eventSource = sources[SSE_URL]

    // Simulate connection opening
    eventSource.emitOpen()

    await waitFor(() => {
      expect(store.getState().state).toBe(SSEConnectionState.Connected)
      expect(store.getState().lastConnectedAt).toBeInstanceOf(Date)
    })
  })

  it('should call onerror handler and transition to Reconnecting on network error', async () => {
    const { wrapper, store } = createWrapper()
    renderHook(
      () => useSSEConnection(true),
      { wrapper }
    )

    const eventSource = sources[SSE_URL]

    // First open the connection
    eventSource.emitOpen()

    await waitFor(() => {
      expect(store.getState().state).toBe(SSEConnectionState.Connected)
    })

    // Simulate network error - EventSource automatically stays in CONNECTING state during reconnection
    // The mock doesn't change readyState on error, which is correct behavior for network errors
    // We need to manually set it back to CONNECTING to simulate browser reconnection attempt
    eventSource.readyState = 0 // 0 = CONNECTING (browser attempting reconnect)

    const errorEvent = new Event('error')
    eventSource.onerror!(errorEvent)

    await waitFor(() => {
      expect(store.getState().state).toBe(SSEConnectionState.Reconnecting)
    })
  })

  it('should call onerror handler and transition to Error on permanent failure', async () => {
    const { wrapper, store } = createWrapper()
    renderHook(
      () => useSSEConnection(true),
      { wrapper }
    )

    const eventSource = sources[SSE_URL]

    // Simulate permanent failure (readyState = 2 means no retry)
    Object.defineProperty(eventSource, 'readyState', {
      value: 2, // 2 = CLOSED
      writable: true,
      configurable: true
    })

    const closeSpy = vi.spyOn(eventSource, 'close')
    const errorEvent = new Event('error')
    eventSource.onerror!(errorEvent)

    await waitFor(() => {
      expect(store.getState().state).toBe(SSEConnectionState.Error)
      expect(store.getState().lastError).toMatchObject({
        message: expect.stringContaining('Connection failed')
      })
      expect(closeSpy).toHaveBeenCalled()
    })
  })

  it('should close connection and set Disconnected state on unmount', async () => {
    const { wrapper, store } = createWrapper()
    const { unmount } = renderHook(
      () => useSSEConnection(true),
      { wrapper }
    )

    const eventSource = sources[SSE_URL]
    expect(eventSource.readyState).not.toBe(2) // Not CLOSED

    unmount()

    await waitFor(() => {
      expect(eventSource.readyState).toBe(2) // 2 = CLOSED
      expect(store.getState().state).toBe(SSEConnectionState.Disconnected)
    })
  })

  it('should register cleanup with logout registry', async () => {
    const { wrapper } = createWrapper()
    renderHook(
      () => useSSEConnection(true),
      { wrapper }
    )

    const eventSource = sources[SSE_URL]
    expect(eventSource.readyState).not.toBe(2) // Not CLOSED

    // Import and trigger logout cleanup
    const { logoutCleanupRegistry } = await import('@/lib/hooks/logout-cleanup-registry')
    await logoutCleanupRegistry.executeAll()

    expect(eventSource.readyState).toBe(2) // 2 = CLOSED
  })

  it('should unregister cleanup on unmount', async () => {
    const { wrapper } = createWrapper()
    const { unmount } = renderHook(
      () => useSSEConnection(true),
      { wrapper }
    )

    const firstEventSource = sources[SSE_URL]

    // Unmount the hook
    unmount()
    expect(firstEventSource.readyState).toBe(2) // 2 = CLOSED

    // Clear the closed source
    delete sources[SSE_URL]

    // Create a new connection
    renderHook(
      () => useSSEConnection(true),
      { wrapper }
    )

    const newEventSource = sources[SSE_URL]

    // Trigger logout - should only close the NEW connection, not the old one
    const { logoutCleanupRegistry } = await import('@/lib/hooks/logout-cleanup-registry')
    await logoutCleanupRegistry.executeAll()

    expect(newEventSource.readyState).toBe(2) // 2 = CLOSED
    // Old one stays closed (not affected by new cleanup)
    expect(firstEventSource.readyState).toBe(2) // 2 = CLOSED
  })

  it('should handle rapid login/logout cycles without memory leaks', async () => {
    const { wrapper } = createWrapper()
    const { rerender } = renderHook(
      ({ isLoggedIn }) => useSSEConnection(isLoggedIn),
      {
        wrapper,
        initialProps: { isLoggedIn: false }
      }
    )

    const allSources: any[] = []

    // Rapid cycles
    for (let i = 0; i < 5; i++) {
      rerender({ isLoggedIn: true })
      await waitFor(() => expect(sources[SSE_URL]).toBeDefined())

      // Track this source
      allSources.push(sources[SSE_URL])

      rerender({ isLoggedIn: false })
      await waitFor(() => {
        // Source should be closed
        expect(allSources[i].readyState).toBe(2) // 2 = CLOSED
      })

      // Clean up for next iteration
      delete sources[SSE_URL]
    }

    // Verify all sources are closed
    allSources.forEach((source) => {
      expect(source.readyState).toBe(2) // 2 = CLOSED
    })
  })
})
