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
    relationship_role: 'coach'
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

  it('should work without JWT token', async () => {
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
      expect(screen.getByTestId('is-ready')).toHaveTextContent('yes')
    })
  })

  it('should handle JWT errors gracefully', async () => {
    vi.mocked(useCollaborationToken).mockReturnValue({
      jwt: null,
      isLoading: false,
      isError: new Error('Token expired')
    })

    render(
      <EditorCacheProvider sessionId="test-session">
        <TestConsumer />
      </EditorCacheProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-provider')).toHaveTextContent('no')
      expect(screen.getByTestId('is-ready')).toHaveTextContent('yes')
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
})