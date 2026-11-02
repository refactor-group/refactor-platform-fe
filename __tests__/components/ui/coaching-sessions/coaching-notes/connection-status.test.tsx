import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'
import { ConnectionStatus } from '@/components/ui/coaching-sessions/coaching-notes/connection-status'
import { EditorCacheProvider } from '@/components/ui/coaching-sessions/editor-cache-context'
import { TooltipProvider } from '@/components/ui/tooltip'

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
      docsCollabUrl: 'http://test-collab'
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
let mockProviderInstance: any = null

const createMockProvider = () => {
  const provider = {
    status: 'connected', // Default status
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
  mockProviderInstance = provider
  return provider
}

vi.mock('@hocuspocus/provider', () => ({
  TiptapCollabProvider: vi.fn(function() { return createMockProvider() }),
  WebSocketStatus: {
    Connecting: 'connecting',
    Connected: 'connected',
    Disconnected: 'disconnected'
  }
}))

vi.mock('yjs', () => ({
  Doc: vi.fn(function() { return {} })
}))

import { useCollaborationToken } from '@/lib/api/collaboration-token'
import { useAuthStore } from '@/lib/providers/auth-store-provider'

// Helper function to trigger provider events for all registered handlers
const triggerProviderEvent = async (eventName: string, ...args: any[]) => {
  await act(async () => {
    // Update provider status based on event and trigger 'status' event
    if (mockProviderInstance) {
      if (eventName === 'connect' || eventName === 'synced') {
        mockProviderInstance.status = 'connected'
      } else if (eventName === 'disconnect') {
        mockProviderInstance.status = 'disconnected'
      }

      // Trigger 'status' event to notify listeners of status change
      const statusHandlers = mockProviderEventHandlers.get('status') || []
      statusHandlers.forEach(handler => handler({ status: mockProviderInstance.status }))
    }

    const handlers = mockProviderEventHandlers.get(eventName) || []
    handlers.forEach(handler => handler(...args))
  })
}

const renderStatus = () =>
  render(
    <TooltipProvider>
      <EditorCacheProvider sessionId="test-session">
        <ConnectionStatus />
      </EditorCacheProvider>
    </TooltipProvider>
  )

// The label is sr-only text inside the status element; the tooltip isn't mounted until hover
const findStatus = async (label: string) =>
  (await screen.findByText(label)).closest('[role="status"]') as HTMLElement

const mockToken = (overrides: Record<string, unknown>) =>
  vi.mocked(useCollaborationToken).mockReturnValue({
    jwt: null,
    isLoading: false,
    isError: false,
    ...overrides
  })

describe('ConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProviderEventHandlers.clear()
    mockProviderInstance = null

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
    it('shows "Connected" when provider is synced', async () => {
      renderStatus()
      await triggerProviderEvent('synced')

      const status = await findStatus('Connected')
      expect(status.querySelector('.lucide-cloud')).toBeInTheDocument()
    })

    it('shows "Connecting" when provider is initializing', async () => {
      mockToken({ isLoading: true })
      renderStatus()

      expect(await findStatus('Connecting')).toBeInTheDocument()
    })

    it('shows "Not connected" when provider disconnects', async () => {
      renderStatus()
      await triggerProviderEvent('synced')
      await findStatus('Connected')

      await triggerProviderEvent('disconnect')

      const status = await findStatus('Not connected')
      expect(status.querySelector('.lucide-cloud-off')).toHaveClass('text-warning')
    })

    it('shows "Not connected" when no JWT token is available', async () => {
      mockToken({})
      renderStatus()

      const status = await findStatus('Not connected')
      expect(status.querySelector('.lucide-cloud-off')).toHaveClass('text-warning')
    })

    it('shows a destructive "Not connected" when JWT token fetch fails', async () => {
      mockToken({ isError: new Error('Token fetch failed') })
      renderStatus()

      const status = await findStatus('Not connected')
      expect(status.querySelector('.lucide-cloud-off')).toHaveClass('text-destructive')
    })
  })

  describe('Connection Transitions', () => {
    it('transitions from Connecting to Connected on sync', async () => {
      renderStatus()
      expect(screen.queryByText('Connected')).not.toBeInTheDocument()

      await triggerProviderEvent('synced')

      expect(await findStatus('Connected')).toBeInTheDocument()
    })

    it('transitions from Not connected back to Connected on reconnect', async () => {
      renderStatus()
      await triggerProviderEvent('synced')
      await findStatus('Connected')

      await triggerProviderEvent('disconnect')
      await findStatus('Not connected')

      await triggerProviderEvent('connect')
      await triggerProviderEvent('synced')

      expect(await findStatus('Connected')).toBeInTheDocument()
    })
  })
})
