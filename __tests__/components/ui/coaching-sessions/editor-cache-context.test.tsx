import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import * as Y from 'yjs'
import { TiptapCollabProvider } from '@hocuspocus/provider'
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
    relationship_role: 'coach',
    isCoachInCurrentRelationship: true,
    hasActiveRelationship: true,
    userId: 'test-user-id'
  }))
}))

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
    { name: 'Collaboration' },
    { name: 'CollaborationCursor' }
  ])
}))

vi.mock('@hocuspocus/provider', () => ({
  TiptapCollabProvider: vi.fn()
}))

vi.mock('yjs', () => ({
  Doc: vi.fn(() => ({
    // Mock Y.Doc methods if needed
    destroy: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }))
}))

import { useCollaborationToken } from '@/lib/api/collaboration-token'
import { useAuthStore } from '@/lib/providers/auth-store-provider'
import { Extensions } from '@/components/ui/coaching-sessions/coaching-notes/extensions'

// Test component to consume the cache context
const TestConsumer = () => {
  try {
    const cache = useEditorCache()
    return (
      <div>
        <div data-testid="y-doc">{cache.yDoc ? 'Y.Doc exists' : 'No Y.Doc'}</div>
        <div data-testid="provider">{cache.collaborationProvider ? 'Provider exists' : 'No provider'}</div>
        <div data-testid="extensions-count">{cache.extensions.length}</div>
        <div data-testid="is-ready">{cache.isReady ? 'Ready' : 'Not ready'}</div>
        <div data-testid="is-loading">{cache.isLoading ? 'Loading' : 'Not loading'}</div>
        <div data-testid="error">{cache.error ? cache.error.message : 'No error'}</div>
        <button onClick={cache.resetCache} data-testid="reset-button">
          Reset Cache
        </button>
      </div>
    )
  } catch (error) {
    return <div data-testid="error">Context error: {(error as Error).message}</div>
  }
}

// Mock provider instance
const mockProvider = {
  disconnect: vi.fn(),
  connect: vi.fn(),
  setAwarenessField: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
}

// Mock extensions array
const mockExtensions = [
  { name: 'StarterKit' },
  { name: 'Collaboration' },
  { name: 'CollaborationCursor' }
]

describe('EditorCacheProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    vi.mocked(useAuthStore).mockReturnValue({
      userSession: {
        display_name: 'Test User',
        id: 'test-user-id'
      }
    })
    
    vi.mocked(useCollaborationToken).mockReturnValue({
      jwt: {
        sub: 'test-doc-id',
        token: 'test-jwt-token'
      },
      isLoading: false,
      isError: false
    })
    
    vi.mocked(Extensions).mockReturnValue(mockExtensions)
    
    // Mock TiptapCollabProvider to automatically trigger onSynced
    vi.mocked(TiptapCollabProvider).mockImplementation((config: any) => {
      // Trigger onSynced immediately to simulate successful connection
      setTimeout(() => {
        if (config.onSynced) {
          config.onSynced()
        }
      }, 0)
      return mockProvider as any
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should throw error when useEditorCache is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestConsumer />)
    }).not.toThrow() // render() doesn't throw, but the component shows the error
    
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Context error: useEditorCache must be used within EditorCacheProvider'
    )
    
    consoleSpy.mockRestore()
  })

  it('should provide initial loading state', async () => {
    vi.mocked(useCollaborationToken).mockReturnValue({
      jwt: null,
      isLoading: true,
      isError: false
    })

    render(
      <EditorCacheProvider sessionId="test-session">
        <TestConsumer />
      </EditorCacheProvider>
    )

    expect(screen.getByTestId('is-loading')).toHaveTextContent('Loading')
    expect(screen.getByTestId('is-ready')).toHaveTextContent('Not ready')
    expect(screen.getByTestId('extensions-count')).toHaveTextContent('0')
  })

  it('should reuse Y.Doc when consumer component remounts', async () => {
    // Test component that we can toggle to simulate remounting consumer
    const ToggleableConsumer = ({ show }: { show: boolean }) => {
      return show ? <TestConsumer /> : <div data-testid="no-consumer">No consumer</div>
    }

    const TestWrapper = () => {
      const [showConsumer, setShowConsumer] = React.useState(true)
      return (
        <EditorCacheProvider sessionId="test-session">
          <ToggleableConsumer show={showConsumer} />
          <button 
            data-testid="toggle-consumer" 
            onClick={() => setShowConsumer(!showConsumer)}
          >
            Toggle
          </button>
        </EditorCacheProvider>
      )
    }

    render(<TestWrapper />)

    // Wait for initial collaboration to sync
    await waitFor(() => {
      expect(screen.getByTestId('is-ready')).toHaveTextContent('Ready')
    })

    // Store reference to first Y.Doc creation call count
    const firstDocCallCount = vi.mocked(Y.Doc).mock.calls.length

    // Hide the consumer (simulating unmount)
    act(() => {
      screen.getByTestId('toggle-consumer').click()
    })

    expect(screen.getByTestId('no-consumer')).toBeInTheDocument()

    // Show the consumer again (simulating remount)
    act(() => {
      screen.getByTestId('toggle-consumer').click()
    })

    // Wait for the consumer to re-render
    await waitFor(() => {
      expect(screen.getByTestId('is-ready')).toHaveTextContent('Ready')
    })

    // Y.Doc should be reused, so no new instances should be created
    expect(vi.mocked(Y.Doc).mock.calls.length).toBe(firstDocCallCount)
    expect(screen.getByTestId('y-doc')).toHaveTextContent('Y.Doc exists')
  })

  it('should cleanup provider when session changes', async () => {
    const { rerender } = render(
      <EditorCacheProvider sessionId="session-1">
        <TestConsumer />
      </EditorCacheProvider>
    )

    // Wait for initial setup
    await waitFor(() => {
      expect(screen.getByTestId('is-ready')).toHaveTextContent('Ready')
    })

    // Verify provider was created
    expect(TiptapCollabProvider).toHaveBeenCalled()
    const initialDisconnectCalls = mockProvider.disconnect.mock.calls.length

    // Change session ID
    rerender(
      <EditorCacheProvider sessionId="session-2">
        <TestConsumer />
      </EditorCacheProvider>
    )

    // Wait for cleanup and new setup
    await waitFor(() => {
      expect(mockProvider.disconnect.mock.calls.length).toBeGreaterThan(initialDisconnectCalls)
    })

    // Verify new Y.Doc was created for new session
    expect(vi.mocked(Y.Doc).mock.calls.length).toBeGreaterThan(1)
  })

  it('should handle JWT token errors gracefully', async () => {
    const testError = new Error('JWT token expired')
    
    vi.mocked(useCollaborationToken).mockReturnValue({
      jwt: null,
      isLoading: false,
      isError: testError
    })

    render(
      <EditorCacheProvider sessionId="test-session">
        <TestConsumer />
      </EditorCacheProvider>
    )

    // Should fall back to non-collaborative extensions
    await waitFor(() => {
      expect(screen.getByTestId('is-ready')).toHaveTextContent('Ready')
      expect(screen.getByTestId('provider')).toHaveTextContent('No provider')
      expect(screen.getByTestId('extensions-count')).toHaveTextContent('3') // Fallback extensions
      expect(screen.getByTestId('error')).toHaveTextContent('JWT token expired')
    })
  })

  it('should reset cache when resetCache is called', async () => {
    render(
      <EditorCacheProvider sessionId="test-session">
        <TestConsumer />
      </EditorCacheProvider>
    )

    // Wait for initial setup
    await waitFor(() => {
      expect(screen.getByTestId('is-ready')).toHaveTextContent('Ready')
    })

    // Reset the cache
    act(() => {
      screen.getByTestId('reset-button').click()
    })

    // Should return to loading state and cleanup provider
    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toHaveTextContent('Loading')
      expect(screen.getByTestId('is-ready')).toHaveTextContent('Not ready')
    })

    expect(mockProvider.disconnect).toHaveBeenCalled()
  })

  it('should initialize collaboration provider with correct parameters', async () => {
    render(
      <EditorCacheProvider sessionId="test-session">
        <TestConsumer />
      </EditorCacheProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-ready')).toHaveTextContent('Ready')
    })

    expect(TiptapCollabProvider).toHaveBeenCalledWith({
      name: 'test-doc-id',
      appId: 'test-app-id',
      token: 'test-jwt-token',
      document: expect.any(Object), // Y.Doc instance
      user: 'Test User',
      connect: true,
      broadcast: true,
      onSynced: expect.any(Function),
      onDisconnect: expect.any(Function)
    })

    expect(mockProvider.setAwarenessField).toHaveBeenCalledWith('user', {
      name: 'Test User',
      color: '#ffcc00'
    })
  })

  it('should handle collaboration sync callback', async () => {
    let syncCallback: (() => void) | undefined

    vi.mocked(TiptapCollabProvider).mockImplementation((config: any) => {
      syncCallback = config.onSynced
      return mockProvider as any
    })

    render(
      <EditorCacheProvider sessionId="test-session">
        <TestConsumer />
      </EditorCacheProvider>
    )

    // Wait for provider to be created
    await waitFor(() => {
      expect(TiptapCollabProvider).toHaveBeenCalled()
    })

    expect(syncCallback).toBeDefined()

    // Simulate sync callback
    act(() => {
      syncCallback!()
    })

    // Should update state to ready with collaborative extensions
    await waitFor(() => {
      expect(screen.getByTestId('is-ready')).toHaveTextContent('Ready')
      expect(screen.getByTestId('is-loading')).toHaveTextContent('Not loading')
      expect(screen.getByTestId('provider')).toHaveTextContent('Provider exists')
      expect(screen.getByTestId('y-doc')).toHaveTextContent('Y.Doc exists')
    })
  })

  it('should handle missing JWT gracefully', async () => {
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

    // Should still work with fallback extensions (no collaboration)
    await waitFor(() => {
      expect(screen.getByTestId('is-ready')).toHaveTextContent('Ready')
      expect(screen.getByTestId('provider')).toHaveTextContent('No provider')
      expect(screen.getByTestId('extensions-count')).toHaveTextContent('3') // Fallback extensions
      expect(screen.getByTestId('error')).toHaveTextContent('No error')
    })
  })
})