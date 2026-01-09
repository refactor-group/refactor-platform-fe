import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { EditorCacheProvider, useEditorCache } from '@/components/ui/coaching-sessions/editor-cache-context'

// Mock external dependencies
vi.mock('@/lib/api/collaboration-token', () => ({
  useCollaborationToken: vi.fn()
}))

vi.mock('@/lib/providers/auth-store-provider', () => ({
  useAuthStore: vi.fn()
}))

vi.mock('@/lib/hooks/use-current-relationship-role', () => ({
  useCurrentRelationshipRole: vi.fn(() => ({
    relationship_role: 'Coach'
  }))
}))

// Mock the logout cleanup registry to track cleanup calls
vi.mock('@/lib/hooks/logout-cleanup-registry', () => {
  const mockUnregister = vi.fn()
  const mockRegistry = {
    register: vi.fn(() => mockUnregister), // Returns unregister function
    executeAll: vi.fn(),
    size: 0
  };
  return {
    logoutCleanupRegistry: mockRegistry
  };
})

vi.mock('@/site.config', () => ({
  siteConfig: {
    env: {
      tiptapAppId: 'test-app-id'
    }
  }
}))

vi.mock('@/components/ui/coaching-sessions/coaching-notes/extensions', () => ({
  Extensions: vi.fn(() => [
    { name: 'StarterKit' },
    { name: 'Collaboration' }
  ])
}))

// Simple TipTap mock
vi.mock('@hocuspocus/provider', () => ({
  TiptapCollabProvider: vi.fn(function() {
    const provider = {
      on: vi.fn((event, callback) => {
        // Auto-trigger sync for simple testing
        if (event === 'synced') {
          setTimeout(() => callback(), 10)
        }
        // Handle awarenessChange event
        if (event === 'awarenessChange') {
          setTimeout(() => callback({ states: new Map() }), 10)
        }
        return provider
      }),
      off: vi.fn(),
      setAwarenessField: vi.fn(),
      destroy: vi.fn(),
      disconnect: vi.fn(),
      connect: vi.fn()
    }
    return provider
  })
}))

vi.mock('yjs', () => ({
  Doc: vi.fn(() => ({}))
}))

import { useCollaborationToken } from '@/lib/api/collaboration-token'
import { useAuthStore } from '@/lib/providers/auth-store-provider'

// Test component
const TestConsumer = ({ onCacheReady }: { onCacheReady?: (cache: any) => void } = {}) => {
  const cache = useEditorCache()
  
  React.useEffect(() => {
    if (onCacheReady) {
      onCacheReady(cache)
    }
  }, [cache, onCacheReady])
  
  return (
    <div>
      <div data-testid="has-provider">{cache.collaborationProvider ? 'yes' : 'no'}</div>
      <div data-testid="is-ready">{cache.isReady ? 'yes' : 'no'}</div>
    </div>
  )
}

describe('EditorCacheProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default happy path mocks
    vi.mocked(useAuthStore).mockReturnValue({
      userSession: { display_name: 'Test User', id: 'user-1' },
      isLoggedIn: true
    })
    
    vi.mocked(useCollaborationToken).mockReturnValue({
      jwt: { sub: 'test-doc', token: 'test-token' },
      isLoading: false,
      isError: false
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should provide context without errors', () => {
    render(
      <EditorCacheProvider sessionId="test-session">
        <TestConsumer />
      </EditorCacheProvider>
    )

    expect(screen.getByTestId('has-provider')).toBeInTheDocument()
    expect(screen.getByTestId('is-ready')).toBeInTheDocument()
  })

  it('should stay in loading state without JWT token', async () => {
    vi.mocked(useCollaborationToken).mockReturnValue({
      jwt: null,
      isLoading: false,
      isError: false
    })

    render(
      <EditorCacheProvider sessionId="test-session">
        <TestConsumer />
      </EditorCacheProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-provider')).toHaveTextContent('no')
      // Without JWT and without error, stays in loading state waiting for token
      expect(screen.getByTestId('is-ready')).toHaveTextContent('no')
    })
  })

  it('should show error state when JWT fetch fails', async () => {
    vi.mocked(useCollaborationToken).mockReturnValue({
      jwt: null,
      isLoading: false,
      isError: new Error('Token expired')
    })

    let cacheRef: any = null

    render(
      <EditorCacheProvider sessionId="test-session">
        <TestConsumer onCacheReady={(cache) => { cacheRef = cache }} />
      </EditorCacheProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-provider')).toHaveTextContent('no')
      // Token error now shows error state with retry option instead of falling back to offline
      expect(screen.getByTestId('is-ready')).toHaveTextContent('no')
      expect(cacheRef?.error).toBeTruthy()
      expect(cacheRef?.error?.message).toContain('Unable to load coaching notes')
    })
  })

  // THE CRITICAL TEST: Logout cleanup
  it('should destroy TipTap provider when user logs out', async () => {
    let cacheRef: any = null

    // Start with logged in user
    render(
      <EditorCacheProvider sessionId="test-session">
        <TestConsumer onCacheReady={(cache) => { cacheRef = cache }} />
      </EditorCacheProvider>
    )

    // Wait for provider to potentially be created and ready state reached
    await waitFor(() => {
      expect(screen.getByTestId('is-ready')).toHaveTextContent('yes')
    }, { timeout: 3000 })

    // Simulate logout cleanup by calling the resetCache function directly
    // This is the same operation that would be triggered by the logout cleanup registry
    act(() => {
      if (cacheRef?.resetCache) {
        cacheRef.resetCache()
      }
    })

    // Provider should be cleared from cache after logout cleanup
    await waitFor(() => {
      expect(screen.getByTestId('has-provider')).toHaveTextContent('no')
    })

    // After reset, the cache should be in loading state (not ready)
    expect(screen.getByTestId('is-ready')).toHaveTextContent('no')
  })

  describe('Provider Lifecycle - Preventing Unnecessary Disconnections', () => {
    it('should NOT disconnect provider when re-rendering with same sessionId', async () => {
      const { TiptapCollabProvider } = await import('@hocuspocus/provider')

      const { rerender } = render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-ready')).toHaveTextContent('yes')
      })

      // Get the mock instance and clear previous calls
      const mockProvider = vi.mocked(TiptapCollabProvider).mock.results[0]?.value
      vi.clearAllMocks()

      // Re-render the same component (simulates user clicking in editor)
      rerender(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      // Wait a bit to ensure no cleanup happens
      await new Promise(resolve => setTimeout(resolve, 50))

      // CRITICAL: Provider should NOT be disconnected
      expect(mockProvider?.disconnect).not.toHaveBeenCalled()

      // CRITICAL: Provider should NOT be recreated
      expect(TiptapCollabProvider).not.toHaveBeenCalled()
    })

    it('should disconnect old provider when sessionId changes', async () => {
      const { TiptapCollabProvider } = await import('@hocuspocus/provider')

      const { rerender } = render(
        <EditorCacheProvider sessionId="session-1">
          <TestConsumer />
        </EditorCacheProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-ready')).toHaveTextContent('yes')
      })

      const oldProvider = vi.mocked(TiptapCollabProvider).mock.results[0]?.value

      // Change session ID
      rerender(
        <EditorCacheProvider sessionId="session-2">
          <TestConsumer />
        </EditorCacheProvider>
      )

      await waitFor(() => {
        // Old provider should be disconnected
        expect(oldProvider?.disconnect).toHaveBeenCalled()
      })

      // New provider should be created
      expect(TiptapCollabProvider).toHaveBeenCalledTimes(2)
    })
  })

  describe('Extension Creation', () => {
    it('should create extensions only once even if synced event fires multiple times', async () => {
      const { Extensions } = await import('@/components/ui/coaching-sessions/coaching-notes/extensions')

      // Create a mock provider that we can control
      const { TiptapCollabProvider } = await import('@hocuspocus/provider')
      let syncedCallback: (() => void) | undefined

      vi.mocked(TiptapCollabProvider).mockImplementationOnce(function() {
        const provider = {
          on: vi.fn((event, callback) => {
            if (event === 'synced') {
              syncedCallback = callback
            }
            return provider
          }),
          off: vi.fn(),
          setAwarenessField: vi.fn(),
          destroy: vi.fn(),
          disconnect: vi.fn(),
          connect: vi.fn()
        }
        return provider as any
      })

      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      // Wait for provider initialization
      await waitFor(() => {
        expect(syncedCallback).toBeDefined()
      })

      // Trigger synced event multiple times
      act(() => {
        syncedCallback!()
        syncedCallback!()
        syncedCallback!()
      })

      // Extensions should only be created once
      expect(Extensions).toHaveBeenCalledTimes(1)
    })
  })

  describe('Awareness State Management', () => {
    it('should use setAwarenessField for setting user presence', async () => {
      const { TiptapCollabProvider } = await import('@hocuspocus/provider')

      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-ready')).toHaveTextContent('yes')
      })

      const mockProvider = vi.mocked(TiptapCollabProvider).mock.results[0]?.value

      // Should have called setAwarenessField with presence data
      expect(mockProvider?.setAwarenessField).toHaveBeenCalledWith(
        'presence',
        expect.objectContaining({
          userId: 'user-1',
          name: 'Test User',
          status: 'connected'
        })
      )
    })

    it('should update presence state when awarenessChange event fires', async () => {
      const { TiptapCollabProvider } = await import('@hocuspocus/provider')
      let awarenessCallback: ((data: any) => void) | undefined

      vi.mocked(TiptapCollabProvider).mockImplementationOnce(function() {
        const provider = {
          on: vi.fn((event, callback) => {
            if (event === 'awarenessChange') {
              awarenessCallback = callback
            }
            return provider
          }),
          off: vi.fn(),
          setAwarenessField: vi.fn(),
          destroy: vi.fn(),
          disconnect: vi.fn(),
          connect: vi.fn()
        }
        return provider as any
      })

      let cacheRef: any = null

      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer onCacheReady={(cache) => { cacheRef = cache }} />
        </EditorCacheProvider>
      )

      await waitFor(() => {
        expect(awarenessCallback).toBeDefined()
      })

      // Simulate awareness change with user data
      act(() => {
        awarenessCallback!({
          states: [
            {
              clientId: 1,
              presence: {
                userId: 'user-1',
                name: 'Test User',
                relationshipRole: 'Coach',
                color: '#ff0000',
                status: 'connected'
              }
            },
            {
              clientId: 2,
              presence: {
                userId: 'user-2',
                name: 'Other User',
                relationshipRole: 'Coachee',
                color: '#00ff00',
                status: 'connected'
              }
            }
          ]
        })
      })

      // Presence state should be updated
      expect(cacheRef?.presenceState.users.size).toBe(2)
      expect(cacheRef?.presenceState.users.get('user-1')).toMatchObject({
        userId: 'user-1',
        name: 'Test User'
      })
    })

    it('should NOT call setAwarenessField on disconnect event (already offline)', async () => {
      const { TiptapCollabProvider } = await import('@hocuspocus/provider')
      let disconnectCallback: (() => void) | undefined

      vi.mocked(TiptapCollabProvider).mockImplementationOnce(function() {
        const provider = {
          on: vi.fn((event, callback) => {
            if (event === 'disconnect') {
              disconnectCallback = callback
            }
            return provider
          }),
          off: vi.fn(),
          setAwarenessField: vi.fn(),
          destroy: vi.fn(),
          disconnect: vi.fn(),
          connect: vi.fn()
        }
        return provider as any
      })

      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      await waitFor(() => {
        expect(disconnectCallback).toBeDefined()
      })

      const mockProvider = vi.mocked(TiptapCollabProvider).mock.results[0]?.value
      vi.clearAllMocks()

      // Trigger disconnect event
      act(() => {
        disconnectCallback!()
      })

      // Should NOT call setAwarenessField because we're already disconnected
      // The awareness protocol will handle removing stale clients via timeout
      expect(mockProvider?.setAwarenessField).not.toHaveBeenCalled()
    })

    it('should mark users as disconnected when they disappear from awareness states', async () => {
      const { TiptapCollabProvider } = await import('@hocuspocus/provider')
      let awarenessCallback: ((data: any) => void) | undefined

      vi.mocked(TiptapCollabProvider).mockImplementationOnce(function() {
        const provider = {
          on: vi.fn((event, callback) => {
            if (event === 'awarenessChange') {
              awarenessCallback = callback
            }
            return provider
          }),
          off: vi.fn(),
          setAwarenessField: vi.fn(),
          destroy: vi.fn(),
          disconnect: vi.fn(),
          connect: vi.fn()
        }
        return provider as any
      })

      let cacheRef: any = null

      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer onCacheReady={(cache) => { cacheRef = cache }} />
        </EditorCacheProvider>
      )

      await waitFor(() => {
        expect(awarenessCallback).toBeDefined()
      })

      // First, simulate both users being connected
      act(() => {
        awarenessCallback!({
          states: [
            {
              clientId: 1,
              presence: {
                userId: 'user-1',
                name: 'Test User',
                relationshipRole: 'Coach',
                color: '#ff0000',
                isConnected: true
              }
            },
            {
              clientId: 2,
              presence: {
                userId: 'user-2',
                name: 'Other User',
                relationshipRole: 'Coachee',
                color: '#00ff00',
                isConnected: true
              }
            }
          ]
        })
      })

      // Verify both users are connected
      expect(cacheRef?.presenceState.users.size).toBe(2)
      expect(cacheRef?.presenceState.users.get('user-2')?.status).toBe('connected')

      // Now simulate user-2 disappearing (network disconnect)
      act(() => {
        awarenessCallback!({
          states: [
            {
              clientId: 1,
              presence: {
                userId: 'user-1',
                name: 'Test User',
                relationshipRole: 'Coach',
                color: '#ff0000',
                isConnected: true
              }
            }
            // user-2 is no longer in the states array
          ]
        })
      })

      // User-2 should still be in the map but marked as disconnected
      expect(cacheRef?.presenceState.users.size).toBe(2)
      expect(cacheRef?.presenceState.users.get('user-2')?.status).toBe('disconnected')
      expect(cacheRef?.presenceState.users.get('user-1')?.status).toBe('connected')
    })
  })
})