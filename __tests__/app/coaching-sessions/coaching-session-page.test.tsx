import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import CoachingSessionsPage from '@/app/coaching-sessions/[id]/page'
import { TestProviders } from '@/test-utils/providers'

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
  useSearchParams: vi.fn(),
}))

// Mock the coaching session hooks
vi.mock('@/lib/hooks/use-current-coaching-session', () => ({
  useCurrentCoachingSession: vi.fn(() => ({
    currentCoachingSessionId: 'session-123',
    currentCoachingSession: {
      id: 'session-123',
      title: 'Test Session',
      coaching_relationship_id: 'rel-123'
    },
    isError: false,
  }))
}))

vi.mock('@/lib/hooks/use-current-coaching-relationship', () => ({
  useCurrentCoachingRelationship: vi.fn(() => ({
    currentCoachingRelationshipId: 'rel-123',
    setCurrentCoachingRelationshipId: vi.fn(),
  }))
}))

// Mock auth store
vi.mock('@/lib/providers/auth-store-provider', () => ({
  useAuthStore: vi.fn(() => ({
    userId: 'user-123',
    isLoggedIn: true,
  })),
  AuthStoreProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock other components
vi.mock('@/components/ui/coaching-sessions/coaching-session-title', () => ({
  CoachingSessionTitle: () => <div>Test Session</div>
}))

vi.mock('@/components/ui/coaching-session-selector', () => ({
  default: () => <div>Session Selector</div>
}))

vi.mock('@/components/ui/share-session-link', () => ({
  default: () => <div>Share Link</div>
}))

vi.mock('@/components/ui/coaching-sessions/overarching-goal-container', () => ({
  OverarchingGoalContainer: () => <div>Overarching Goals</div>
}))

vi.mock('@/components/ui/coaching-sessions/coaching-tabs-container', () => ({
  CoachingTabsContainer: ({ defaultValue, onTabChange }: { defaultValue: string, onTabChange: (value: string) => void }) => (
    <div data-testid="coaching-tabs-container">
      <div data-testid="current-tab">{defaultValue}</div>
      <button onClick={() => onTabChange('agreements')} data-testid="switch-to-agreements">
        Switch to Agreements
      </button>
      <button onClick={() => onTabChange('actions')} data-testid="switch-to-actions">
        Switch to Actions
      </button>
      <button onClick={() => onTabChange('notes')} data-testid="switch-to-notes">
        Switch to Notes
      </button>
    </div>
  )
}))

/**
 * Test Suite: URL Parameter Persistence for Coaching Session Tabs
 * 
 * Purpose: Validates that tab selection persists in URL parameters and behaves correctly
 * across page refreshes and navigation while maintaining clean URLs for the default tab.
 */
describe('CoachingSessionsPage URL Parameter Persistence', () => {
  const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
  }

  const mockParams = {
    id: 'session-123'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue(mockRouter)
    ;(useParams as any).mockReturnValue(mockParams)
  })

  /**
   * Asserts that without ?tab=X parameter, the page defaults to 'notes' tab
   * This ensures clean URLs and proper fallback behavior
   */
  it('should default to notes tab when no URL parameter is present', () => {
    const mockSearchParams = new URLSearchParams()
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    expect(screen.getByTestId('current-tab')).toHaveTextContent('notes')
  })

  /**
   * Asserts that ?tab=agreements correctly sets the active tab to 'agreements'
   * This validates URL-to-state synchronization
   */
  it('should use tab parameter from URL when present', () => {
    const mockSearchParams = new URLSearchParams('tab=agreements')
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    expect(screen.getByTestId('current-tab')).toHaveTextContent('agreements')
  })

  /**
   * Asserts that clicking a tab trigger calls router.replace with the correct URL parameter
   * This ensures tab changes are reflected in the URL for sharing and bookmarking
   */
  it('should update URL when switching to non-default tab', async () => {
    const mockSearchParams = new URLSearchParams()
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { pathname: '/coaching-sessions/session-123' },
      writable: true
    })

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    fireEvent.click(screen.getByTestId('switch-to-agreements'))

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(
        '/coaching-sessions/session-123?tab=agreements',
        { scroll: false }
      )
    })
  })

  /**
   * Asserts that switching back to 'notes' removes the ?tab= parameter to keep URLs clean
   * This maintains URL cleanliness by omitting default values
   */
  it('should remove tab parameter when switching to notes (default)', async () => {
    const mockSearchParams = new URLSearchParams('tab=agreements')
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)

    Object.defineProperty(window, 'location', {
      value: { pathname: '/coaching-sessions/session-123' },
      writable: true
    })

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    fireEvent.click(screen.getByTestId('switch-to-notes'))

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(
        '/coaching-sessions/session-123',
        { scroll: false }
      )
    })
  })

  /**
   * Asserts that existing parameters like ?other=value are maintained when tab changes
   * This ensures tab switching doesn't break other URL-based functionality
   */
  it('should preserve other URL parameters when switching tabs', async () => {
    const mockSearchParams = new URLSearchParams('other=value&tab=notes')
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)

    Object.defineProperty(window, 'location', {
      value: { pathname: '/coaching-sessions/session-123' },
      writable: true
    })

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    fireEvent.click(screen.getByTestId('switch-to-actions'))

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(
        '/coaching-sessions/session-123?other=value&tab=actions',
        { scroll: false }
      )
    })
  })
})