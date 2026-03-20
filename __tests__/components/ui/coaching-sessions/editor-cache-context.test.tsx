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
  useCurrentRelationshipRole: vi.fn()
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

// Controllable TipTap mock: captures event handlers so tests can trigger events manually
vi.mock('@hocuspocus/provider', () => ({
  TiptapCollabProvider: vi.fn(function() {
    const eventHandlers = new Map<string, Function[]>()
    const provider = {
      status: 'connecting',
      on: vi.fn((event: string, callback: Function) => {
        const handlers = eventHandlers.get(event) || []
        handlers.push(callback)
        eventHandlers.set(event, handlers)
        return provider
      }),
      off: vi.fn(),
      setAwarenessField: vi.fn(),
      destroy: vi.fn(),
      disconnect: vi.fn(),
      connect: vi.fn(),
      // Test helper: trigger a registered event for all handlers
      _triggerEvent: (event: string, ...args: any[]) => {
        const handlers = eventHandlers.get(event) || []
        handlers.forEach(handler => handler(...args))
      },
      _eventHandlers: eventHandlers,
    }
    return provider
  }),
  WebSocketStatus: {
    Connecting: 'connecting',
    Connected: 'connected',
    Disconnected: 'disconnected',
  },
}))

vi.mock('yjs', () => ({
  Doc: vi.fn(function() { return {} })
}))

import { useCollaborationToken } from '@/lib/api/collaboration-token'
import { useAuthStore } from '@/lib/providers/auth-store-provider'
import { useCurrentRelationshipRole } from '@/lib/hooks/use-current-relationship-role'
import { ConnectionStatus } from '@/components/ui/coaching-sessions/coaching-notes/connection-status'
import { Some, None } from '@/types/option'
import { RelationshipRole } from '@/types/relationship-role'

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
      <div data-testid="has-extensions">{cache.extensions.length > 0 ? 'yes' : 'no'}</div>
      <div data-testid="is-loading">{cache.isLoading ? 'yes' : 'no'}</div>
    </div>
  )
}

/** Helper: trigger synced on the provider and wait for the editor to become ready */
const triggerSyncedAndWaitForReady = async (mockProvider: any) => {
  act(() => {
    mockProvider._triggerEvent('synced')
  })
  await waitFor(() => {
    expect(screen.getByTestId('is-ready')).toHaveTextContent('yes')
  })
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

    // Default: role is immediately known as Coach (happy path).
    // Individual tests override this to simulate loading states.
    vi.mocked(useCurrentRelationshipRole).mockReturnValue({
      relationship_role: Some(RelationshipRole.Coach)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** Helper: get the most recently created mock provider instance */
  const getLatestMockProvider = async () => {
    const { TiptapCollabProvider } = await import('@hocuspocus/provider')
    const results = vi.mocked(TiptapCollabProvider).mock.results
    return results[results.length - 1]?.value
  }

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

    // Trigger synced to reach ready state
    const mockProvider = await getLatestMockProvider()
    await triggerSyncedAndWaitForReady(mockProvider)

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

      // Trigger synced to reach ready state
      const mockProvider = vi.mocked(TiptapCollabProvider).mock.results[0]?.value
      await triggerSyncedAndWaitForReady(mockProvider)

      // Clear previous calls
      vi.clearAllMocks()

      // Re-render the same component (simulates user clicking in editor)
      await act(async () => {
        rerender(
          <EditorCacheProvider sessionId="test-session">
            <TestConsumer />
          </EditorCacheProvider>
        )
      })

      // After rerender and effects flushed - verify provider was not disturbed
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

      // Trigger synced for first provider
      const oldProvider = vi.mocked(TiptapCollabProvider).mock.results[0]?.value
      await triggerSyncedAndWaitForReady(oldProvider)

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
    it('should create extensions when sync completes', async () => {
      const { Extensions } = await import('@/components/ui/coaching-sessions/coaching-notes/extensions')
      vi.mocked(Extensions).mockClear()

      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      // Before sync: no extensions yet
      expect(screen.getByTestId('has-extensions')).toHaveTextContent('no')
      expect(screen.getByTestId('is-ready')).toHaveTextContent('no')

      // Trigger synced
      const mockProvider = await getLatestMockProvider()
      await triggerSyncedAndWaitForReady(mockProvider)

      // Now extensions should exist
      expect(screen.getByTestId('has-extensions')).toHaveTextContent('yes')
      expect(Extensions).toHaveBeenCalledTimes(1)
    })

    it('should create extensions only once even if synced event fires multiple times', async () => {
      const { Extensions } = await import('@/components/ui/coaching-sessions/coaching-notes/extensions')
      vi.mocked(Extensions).mockClear()

      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      const mockProvider = await getLatestMockProvider()

      // Trigger synced event multiple times
      act(() => {
        mockProvider._triggerEvent('synced')
        mockProvider._triggerEvent('synced')
        mockProvider._triggerEvent('synced')
      })

      // Extensions should only be created once
      expect(Extensions).toHaveBeenCalledTimes(1)
    })
  })

  describe('Sync Timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should enable offline editing after SYNC_TIMEOUT_MS when sync does not complete', async () => {
      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      // Before timeout: not ready, no extensions
      expect(screen.getByTestId('is-ready')).toHaveTextContent('no')
      expect(screen.getByTestId('has-extensions')).toHaveTextContent('no')

      // Advance past the sync timeout (10 seconds)
      await act(async () => {
        vi.advanceTimersByTime(10_000)
      })

      // isReady should now be true with extensions (offline editing enabled)
      await waitFor(() => {
        expect(screen.getByTestId('is-ready')).toHaveTextContent('yes')
        expect(screen.getByTestId('has-extensions')).toHaveTextContent('yes')
      })
    })

    it('should clear sync timeout when sync completes normally', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      const callCountBefore = clearTimeoutSpy.mock.calls.length

      // Trigger synced before timeout fires
      const mockProvider = await getLatestMockProvider()
      act(() => {
        mockProvider._triggerEvent('synced')
      })

      // clearTimeout should have been called by the synced handler
      expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(callCountBefore)

      // isReady should be true
      await waitFor(() => {
        expect(screen.getByTestId('is-ready')).toHaveTextContent('yes')
      })

      clearTimeoutSpy.mockRestore()
    })

    it('should not cause errors when sync fires after timeout (idempotent)', async () => {
      const { Extensions } = await import('@/components/ui/coaching-sessions/coaching-notes/extensions')
      vi.mocked(Extensions).mockClear()

      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      // Let the timeout fire first
      await act(async () => {
        vi.advanceTimersByTime(10_000)
      })

      await waitFor(() => {
        expect(screen.getByTestId('is-ready')).toHaveTextContent('yes')
      })

      // Now trigger a late synced event — should be harmless
      const mockProvider = await getLatestMockProvider()
      act(() => {
        mockProvider._triggerEvent('synced')
      })

      // Should still be ready, no errors, extensions created only once
      expect(screen.getByTestId('is-ready')).toHaveTextContent('yes')
      expect(screen.getByTestId('has-provider')).toHaveTextContent('yes')
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

      // Trigger synced to reach ready state
      const mockProvider = vi.mocked(TiptapCollabProvider).mock.results[0]?.value
      await triggerSyncedAndWaitForReady(mockProvider)

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
      let cacheRef: any = null

      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer onCacheReady={(cache) => { cacheRef = cache }} />
        </EditorCacheProvider>
      )

      const mockProvider = await getLatestMockProvider()

      // Simulate awareness change with user data
      act(() => {
        mockProvider._triggerEvent('awarenessChange', {
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
      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      const mockProvider = await getLatestMockProvider()
      vi.clearAllMocks()

      // Trigger disconnect event
      act(() => {
        mockProvider._triggerEvent('disconnect')
      })

      // Should NOT call setAwarenessField because we're already disconnected
      // The awareness protocol will handle removing stale clients via timeout
      expect(mockProvider?.setAwarenessField).not.toHaveBeenCalled()
    })

    it('should mark users as disconnected when they disappear from awareness states', async () => {
      let cacheRef: any = null

      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer onCacheReady={(cache) => { cacheRef = cache }} />
        </EditorCacheProvider>
      )

      const mockProvider = await getLatestMockProvider()

      // First, simulate both users being connected
      act(() => {
        mockProvider._triggerEvent('awarenessChange', {
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
        mockProvider._triggerEvent('awarenessChange', {
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

  describe('Transient Error Handling', () => {
    it('should NOT show error when token error occurs but provider is already connected', async () => {
      // Start with valid token - provider initializes successfully
      vi.mocked(useCollaborationToken).mockReturnValue({
        jwt: { sub: 'test-doc', token: 'test-token' },
        isLoading: false,
        isError: false
      })

      let cacheRef: any = null
      const { rerender } = render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer onCacheReady={(cache) => { cacheRef = cache }} />
        </EditorCacheProvider>
      )

      // Trigger synced to reach ready state
      const mockProvider = await getLatestMockProvider()
      await triggerSyncedAndWaitForReady(mockProvider)

      // Provider should be connected, no error
      expect(screen.getByTestId('has-provider')).toHaveTextContent('yes')
      expect(cacheRef?.error).toBeNull()

      // Simulate transient token error (SWR revalidation failure on tab return)
      // This is what happens when user switches back to Notes tab
      vi.mocked(useCollaborationToken).mockReturnValue({
        jwt: null,
        isLoading: false,
        isError: new Error('Network timeout during revalidation')
      })

      // Re-render with error state (simulates: component re-renders on focus)
      await act(async () => {
        rerender(
          <EditorCacheProvider sessionId="test-session">
            <TestConsumer onCacheReady={(cache) => { cacheRef = cache }} />
          </EditorCacheProvider>
        )
      })

      // CRITICAL ASSERTIONS - This is what the fix ensures:
      // Provider should STILL be connected (not disconnected)
      expect(screen.getByTestId('has-provider')).toHaveTextContent('yes')
      // Should STILL be ready (not show error)
      expect(screen.getByTestId('is-ready')).toHaveTextContent('yes')
      // Error should NOT be set
      expect(cacheRef?.error).toBeNull()
    })

    it('should STILL show error when token fails during initial load (no provider yet)', async () => {
      // This is the existing behavior we want to preserve
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
        // No provider (initial load failed)
        expect(screen.getByTestId('has-provider')).toHaveTextContent('no')
        // Error SHOULD be shown (this is correct behavior for initial load)
        expect(cacheRef?.error).toBeTruthy()
        expect(cacheRef?.error?.message).toContain('Unable to load coaching notes')
      })
    })
  })

  describe('Token Loading and Timeout States', () => {
    it('should show loading state while token is being fetched', async () => {
      // Simulate: token fetch in progress
      vi.mocked(useCollaborationToken).mockReturnValue({
        jwt: null,
        isLoading: true,
        isError: false
      })

      let cacheRef: any = null
      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer onCacheReady={(cache) => { cacheRef = cache }} />
        </EditorCacheProvider>
      )

      // Should be in loading state
      await waitFor(() => {
        expect(cacheRef?.isLoading).toBe(true)
      })
      expect(cacheRef?.isReady).toBe(false)
      expect(cacheRef?.error).toBeNull()
      expect(screen.getByTestId('has-provider')).toHaveTextContent('no')
    })

    it('should transition from loading to error on token timeout', async () => {
      // Start in loading state
      vi.mocked(useCollaborationToken).mockReturnValue({
        jwt: null,
        isLoading: true,
        isError: false
      })

      let cacheRef: any = null
      const { rerender } = render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer onCacheReady={(cache) => { cacheRef = cache }} />
        </EditorCacheProvider>
      )

      // Verify loading state
      await waitFor(() => {
        expect(cacheRef?.isLoading).toBe(true)
      })
      expect(cacheRef?.error).toBeNull()

      // Simulate: 15 second timeout occurs, SWR returns error
      vi.mocked(useCollaborationToken).mockReturnValue({
        jwt: null,
        isLoading: false,
        isError: new Error('Request timed out after 15000ms')
      })

      rerender(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer onCacheReady={(cache) => { cacheRef = cache }} />
        </EditorCacheProvider>
      )

      await waitFor(() => {
        // Should now show error state (no provider to protect)
        expect(cacheRef?.isLoading).toBe(false)
        expect(cacheRef?.error).toBeTruthy()
        expect(cacheRef?.error?.message).toContain('Unable to load coaching notes')
      })
    })

    it('should transition from loading to success when token arrives', async () => {
      // Start in loading state
      vi.mocked(useCollaborationToken).mockReturnValue({
        jwt: null,
        isLoading: true,
        isError: false
      })

      let cacheRef: any = null
      const { rerender } = render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer onCacheReady={(cache) => { cacheRef = cache }} />
        </EditorCacheProvider>
      )

      // Verify loading state
      await waitFor(() => {
        expect(cacheRef?.isLoading).toBe(true)
      })

      // Simulate: token fetch succeeds
      vi.mocked(useCollaborationToken).mockReturnValue({
        jwt: { sub: 'test-doc', token: 'test-token' },
        isLoading: false,
        isError: false
      })

      rerender(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer onCacheReady={(cache) => { cacheRef = cache }} />
        </EditorCacheProvider>
      )

      // Trigger synced to reach ready state
      const mockProvider = await getLatestMockProvider()
      await triggerSyncedAndWaitForReady(mockProvider)

      // Should now be ready with extensions
      expect(screen.getByTestId('has-extensions')).toHaveTextContent('yes')
      expect(cacheRef?.error).toBeNull()
    })
  })

  describe('Integration: Sync Timeout with ConnectionStatus', () => {
    /**
     * Mirrors CoachingNotes' rendering logic:
     * - Shows loading skeleton when isLoading or extensions are empty
     * - Shows editor area with ConnectionStatus when extensions are ready
     */
    const CoachingNotesSimulator = () => {
      const { isLoading, extensions } = useEditorCache()

      if (isLoading || extensions.length === 0) {
        return <div data-testid="loading-skeleton">Loading coaching notes...</div>
      }

      return (
        <div data-testid="editor-area">
          <ConnectionStatus />
        </div>
      )
    }

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should transition from loading skeleton to editor with Offline badge on sync timeout', async () => {
      render(
        <EditorCacheProvider sessionId="test-session">
          <CoachingNotesSimulator />
        </EditorCacheProvider>
      )

      // Should show loading skeleton initially (provider created but sync pending)
      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
      expect(screen.queryByTestId('editor-area')).not.toBeInTheDocument()

      // Advance past the sync timeout (10 seconds) — sync never completes
      await act(async () => {
        vi.advanceTimersByTime(10_000)
      })

      // Loading skeleton should be gone, editor area should be visible
      await waitFor(() => {
        expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        expect(screen.getByTestId('editor-area')).toBeInTheDocument()
      })

      // ConnectionStatus badge should show "Offline" (provider exists but never synced)
      expect(screen.getByText('Offline')).toBeInTheDocument()
    })

    it('should transition from loading skeleton to editor with Connected badge on normal sync', async () => {
      render(
        <EditorCacheProvider sessionId="test-session">
          <CoachingNotesSimulator />
        </EditorCacheProvider>
      )

      // Should show loading skeleton initially
      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()

      // Trigger successful sync
      const mockProvider = await getLatestMockProvider()
      mockProvider.status = 'connected'
      act(() => {
        mockProvider._triggerEvent('synced')
      })

      // Editor area should appear with Connected badge
      await waitFor(() => {
        expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
        expect(screen.getByTestId('editor-area')).toBeInTheDocument()
      })

      expect(screen.getByText('Connected')).toBeInTheDocument()
    })
  })

  // ─── Presence broadcast and relationship role timing ─────────────────────────
  //
  // These tests verify the fix for the race condition where a user's relationship
  // role wasn't known yet when the TipTap provider initialized.
  //
  // Root cause (now fixed): useCurrentRelationshipRole returned Coachee as a default
  // when currentCoachingRelationship hadn't loaded yet, so the coach user's first
  // presence broadcast incorrectly identified them as Coachee. The old re-broadcast
  // effect that was meant to correct this had a bug: it updated previousRoleRef
  // unconditionally (even when no broadcast occurred), so by the time cache.isReady
  // became true the "role changed" flag was already cleared.
  //
  // Fix: relationship_role is now Option<RelationshipRole>. The initial broadcast is
  // suppressed while the role is None. The re-broadcast effect fires as soon as both
  // conditions are true: userRole.some AND cache.isReady.
  describe('Presence broadcast and relationship role timing', () => {
    it('should NOT broadcast presence at all while the relationship role is None (not yet loaded)', async () => {
      // Simulate the common case: provider initializes before SWR returns relationship data
      vi.mocked(useCurrentRelationshipRole).mockReturnValue({
        relationship_role: None
      })

      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      const mockProvider = await getLatestMockProvider()
      await triggerSyncedAndWaitForReady(mockProvider)

      // No presence broadcast should have happened — the role is unknown and there
      // is nothing correct to broadcast yet. Prior to the fix, this would have
      // broadcast relationshipRole: 'Coachee' (the incorrect default).
      expect(mockProvider.setAwarenessField).not.toHaveBeenCalledWith(
        'presence',
        expect.anything()
      )
    })

    it('should broadcast with correct role when role becomes Some after editor is already ready', async () => {
      // Ordering: editor syncs first, relationship data arrives second
      vi.mocked(useCurrentRelationshipRole).mockReturnValue({
        relationship_role: None
      })

      const { rerender } = render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      const mockProvider = await getLatestMockProvider()
      await triggerSyncedAndWaitForReady(mockProvider)

      // Still no broadcast — role unknown
      expect(mockProvider.setAwarenessField).not.toHaveBeenCalledWith('presence', expect.anything())

      // Relationship loads — role transitions from None to Some(Coach)
      vi.mocked(useCurrentRelationshipRole).mockReturnValue({
        relationship_role: Some(RelationshipRole.Coach)
      })
      await act(async () => {
        rerender(
          <EditorCacheProvider sessionId="test-session">
            <TestConsumer />
          </EditorCacheProvider>
        )
      })

      // Now the correct role must be broadcast
      expect(mockProvider.setAwarenessField).toHaveBeenCalledWith(
        'presence',
        expect.objectContaining({
          userId: 'user-1',
          name: 'Test User',
          relationshipRole: RelationshipRole.Coach,
          status: 'connected',
        })
      )
      // And critically: the wrong default must never have been broadcast
      expect(mockProvider.setAwarenessField).not.toHaveBeenCalledWith(
        'presence',
        expect.objectContaining({ relationshipRole: RelationshipRole.Coachee })
      )
    })

    it('should broadcast with correct role when role becomes Some BEFORE editor syncs (the race)', async () => {
      // This is the exact race the bug fix targets:
      //   1. Provider initializes with role = None  → no broadcast
      //   2. Relationship loads, role = Some(Coach) → no broadcast yet (editor not ready)
      //   3. Editor syncs, cache.isReady = true     → broadcast fires with Coach ✓
      //
      // With the OLD code the sequence was:
      //   1. Provider initializes with role = Coachee (wrong default) → broadcasts Coachee ✗
      //   2. Role changes Coachee→Coach, but cache.isReady=false so previousRoleRef was
      //      updated without broadcasting
      //   3. cache.isReady=true, but roleChanged=false → no correction → stuck as Coachee ✗
      vi.mocked(useCurrentRelationshipRole).mockReturnValue({
        relationship_role: None
      })

      const { rerender } = render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      const mockProvider = await getLatestMockProvider()

      // Step 2: relationship data arrives while editor is still syncing
      vi.mocked(useCurrentRelationshipRole).mockReturnValue({
        relationship_role: Some(RelationshipRole.Coach)
      })
      await act(async () => {
        rerender(
          <EditorCacheProvider sessionId="test-session">
            <TestConsumer />
          </EditorCacheProvider>
        )
      })

      // Editor still not ready — no broadcast yet
      expect(screen.getByTestId('is-ready')).toHaveTextContent('no')
      expect(mockProvider.setAwarenessField).not.toHaveBeenCalledWith('presence', expect.anything())

      // Step 3: editor syncs
      await triggerSyncedAndWaitForReady(mockProvider)

      // Must broadcast Coach — never Coachee
      expect(mockProvider.setAwarenessField).toHaveBeenCalledWith(
        'presence',
        expect.objectContaining({
          relationshipRole: RelationshipRole.Coach,
          status: 'connected',
        })
      )
      expect(mockProvider.setAwarenessField).not.toHaveBeenCalledWith(
        'presence',
        expect.objectContaining({ relationshipRole: RelationshipRole.Coachee })
      )
    })

    it('should broadcast immediately on provider init when role is already Some', async () => {
      // Happy path: SWR returns cached relationship data before provider initializes
      // (role is Some(Coachee) from the start)
      vi.mocked(useCurrentRelationshipRole).mockReturnValue({
        relationship_role: Some(RelationshipRole.Coachee)
      })

      render(
        <EditorCacheProvider sessionId="test-session">
          <TestConsumer />
        </EditorCacheProvider>
      )

      const mockProvider = await getLatestMockProvider()
      await triggerSyncedAndWaitForReady(mockProvider)

      expect(mockProvider.setAwarenessField).toHaveBeenCalledWith(
        'presence',
        expect.objectContaining({
          userId: 'user-1',
          relationshipRole: RelationshipRole.Coachee,
          status: 'connected',
        })
      )
    })
  })
})
