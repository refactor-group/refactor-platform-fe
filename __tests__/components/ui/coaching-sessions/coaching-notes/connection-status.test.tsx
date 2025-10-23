import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'
import { ConnectionStatus } from '@/components/ui/coaching-sessions/coaching-notes/connection-status'
import { EditorCacheProvider } from '@/components/ui/coaching-sessions/editor-cache-context'

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

vi.mock('@/lib/hooks/logout-cleanup-registry', () => {
  const mockUnregister = vi.fn()
  const mockRegistry = {
    register: vi.fn(() => mockUnregister),
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

// Mock TipTap provider with controllable event emitters
// Support multiple handlers per event (like a real event emitter)
const mockProviderEventHandlers = new Map<string, Function[]>()

const createMockProvider = () => {
  const provider = {
    on: vi.fn((event: string, callback: Function) => {
      const handlers = mockProviderEventHandlers.get(event) || []
      handlers.push(callback)
      mockProviderEventHandlers.set(event, handlers)
      return provider
    }),
    off: vi.fn((event: string, callback: Function) => {
      const handlers = mockProviderEventHandlers.get(event) || []
      const filtered = handlers.filter(h => h !== callback)
      mockProviderEventHandlers.set(event, filtered)
      return provider
    }),
    setAwarenessField: vi.fn(),
    destroy: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn()
  }
  return provider
}

vi.mock('@hocuspocus/provider', () => ({
  TiptapCollabProvider: vi.fn(() => createMockProvider())
}))

vi.mock('yjs', () => ({
  Doc: vi.fn(() => ({}))
}))

import { useCollaborationToken } from '@/lib/api/collaboration-token'
import { useAuthStore } from '@/lib/providers/auth-store-provider'

// Helper function to trigger provider events for all registered handlers
const triggerProviderEvent = async (eventName: string, ...args: any[]) => {
  await act(async () => {
    const handlers = mockProviderEventHandlers.get(eventName) || []
    handlers.forEach(handler => handler(...args))
  })
}

describe('ConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProviderEventHandlers.clear()

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

  describe('Connection States', () => {
    it('should display "Connected" when provider is synced', async () => {
      render(
        <EditorCacheProvider sessionId="test-session">
          <ConnectionStatus />
        </EditorCacheProvider>
      )

      // Trigger synced event for all handlers
      await triggerProviderEvent('synced')

      // Should show "Connected" badge
      const badge = await screen.findByText('Connected')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-secondary') // Secondary variant for connected state
    })

    it('should display "Connecting..." when provider is initializing', () => {
      // Mock loading state
      vi.mocked(useCollaborationToken).mockReturnValue({
        jwt: null,
        isLoading: true,
        isError: false
      })

      render(
        <EditorCacheProvider sessionId="test-session">
          <ConnectionStatus />
        </EditorCacheProvider>
      )

      // Should show "Connecting..." badge
      const badge = screen.getByText('Connecting...')
      expect(badge).toBeInTheDocument()
    })

    it('should display "Offline" when provider disconnects', async () => {
      render(
        <EditorCacheProvider sessionId="test-session">
          <ConnectionStatus />
        </EditorCacheProvider>
      )

      // First sync
      await triggerProviderEvent('synced')

      // Wait for Connected state
      await screen.findByText('Connected')

      // Then disconnect
      await triggerProviderEvent('disconnect')

      // Should show "Offline" badge
      const badge = await screen.findByText('Offline')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-secondary') // Secondary variant for offline state
    })

    it('should display "Offline" when no JWT token is available', () => {
      vi.mocked(useCollaborationToken).mockReturnValue({
        jwt: null,
        isLoading: false,
        isError: false
      })

      render(
        <EditorCacheProvider sessionId="test-session">
          <ConnectionStatus />
        </EditorCacheProvider>
      )

      // Should show "Offline" badge
      const badge = screen.getByText('Offline')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-secondary') // Secondary variant for offline mode
    })

    it('should display "Error" when JWT token fetch fails', () => {
      vi.mocked(useCollaborationToken).mockReturnValue({
        jwt: null,
        isLoading: false,
        isError: new Error('Token fetch failed')
      })

      render(
        <EditorCacheProvider sessionId="test-session">
          <ConnectionStatus />
        </EditorCacheProvider>
      )

      // Should show "Error" badge
      const badge = screen.getByText('Error')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-destructive') // Destructive variant for error state
    })
  })

  describe('Connection Transitions', () => {
    it('should transition from Connecting to Connected on sync', async () => {
      render(
        <EditorCacheProvider sessionId="test-session">
          <ConnectionStatus />
        </EditorCacheProvider>
      )

      // Initially should be connecting or offline
      expect(screen.queryByText('Connected')).not.toBeInTheDocument()

      // Trigger sync event
      await triggerProviderEvent('synced')

      // Should transition to Connected
      const connectedBadge = await screen.findByText('Connected')
      expect(connectedBadge).toBeInTheDocument()
    })

    it('should transition from Connected to Offline on disconnect event', async () => {
      render(
        <EditorCacheProvider sessionId="test-session">
          <ConnectionStatus />
        </EditorCacheProvider>
      )

      // Trigger sync to get to connected state
      await triggerProviderEvent('synced')
      await screen.findByText('Connected')

      // Trigger disconnect
      await triggerProviderEvent('disconnect')

      // Should transition to Offline
      const offlineBadge = await screen.findByText('Offline')
      expect(offlineBadge).toBeInTheDocument()
    })

    it('should transition from Offline back to Connected on reconnect', async () => {
      render(
        <EditorCacheProvider sessionId="test-session">
          <ConnectionStatus />
        </EditorCacheProvider>
      )

      // Sync -> Disconnect -> Reconnect
      await triggerProviderEvent('synced')
      await screen.findByText('Connected')

      await triggerProviderEvent('disconnect')
      await screen.findByText('Offline')

      await triggerProviderEvent('connect')
      await triggerProviderEvent('synced')

      // Should transition back to Connected
      const connectedBadge = await screen.findByText('Connected')
      expect(connectedBadge).toBeInTheDocument()
    })
  })

  describe('Visual States', () => {
    it('should use secondary variant for connected state', async () => {
      render(
        <EditorCacheProvider sessionId="test-session">
          <ConnectionStatus />
        </EditorCacheProvider>
      )

      await triggerProviderEvent('synced')

      const badge = await screen.findByText('Connected')
      expect(badge.className).toContain('bg-secondary')
    })

    it('should use secondary variant for offline state', async () => {
      render(
        <EditorCacheProvider sessionId="test-session">
          <ConnectionStatus />
        </EditorCacheProvider>
      )

      await triggerProviderEvent('synced')
      await screen.findByText('Connected')

      await triggerProviderEvent('disconnect')

      const badge = await screen.findByText('Offline')
      expect(badge.className).toContain('bg-secondary')
    })

    it('should use default variant for connecting state', () => {
      vi.mocked(useCollaborationToken).mockReturnValue({
        jwt: null,
        isLoading: true,
        isError: false
      })

      render(
        <EditorCacheProvider sessionId="test-session">
          <ConnectionStatus />
        </EditorCacheProvider>
      )

      const badge = screen.getByText('Connecting...')
      expect(badge.className).toContain('bg-primary')
    })
  })
})
