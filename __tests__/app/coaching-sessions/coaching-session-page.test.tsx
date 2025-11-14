import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import CoachingSessionsPage from '@/app/coaching-sessions/[id]/page'
import { TestProviders } from '@/test-utils/providers'
import { useCurrentCoachingSession } from '@/lib/hooks/use-current-coaching-session'
import { useCurrentCoachingRelationship } from '@/lib/hooks/use-current-coaching-relationship'

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
  useSearchParams: vi.fn(),
}))

// Mock the coaching session hooks
vi.mock('@/lib/hooks/use-current-coaching-session')
vi.mock('@/lib/hooks/use-current-coaching-relationship')

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

    // Set default mocks for relationship hooks
    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: {
        id: 'session-123',
        title: 'Test Session',
        coaching_relationship_id: 'rel-123'
      } as any,
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    vi.mocked(useCurrentCoachingRelationship).mockReturnValue({
      currentCoachingRelationshipId: 'rel-123',
      setCurrentCoachingRelationshipId: vi.fn(),
      currentCoachingRelationship: null,
      isLoading: false,
      isError: false,
      currentOrganizationId: 'org-123',
      resetCoachingRelationshipState: vi.fn(),
      refresh: vi.fn(),
    })
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

/**
 * Test Suite: Relationship Auto-Sync Behavior
 *
 * Purpose: Validates that the coaching relationship ID is correctly synced from the current
 * session data to the store in various navigation scenarios, fixing Bug #228 while preserving
 * the fix for Issue #79 (new tab support).
 */
describe('CoachingSessionsPage - Relationship Auto-Sync', () => {
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
    ;(useSearchParams as any).mockReturnValue(new URLSearchParams())
  })

  /**
   * Test: First Load with Empty Store (Issue #79)
   *
   * Scenario: User opens a session URL in a new tab/window with empty sessionStorage
   * Expected: Relationship ID should be synced from session data to store AND refresh called
   * This ensures Issue #79 (new tab support) continues to work
   */
  it('should sync relationship ID on first load with empty store', () => {
    const mockSetRelationshipId = vi.fn()
    const mockRefresh = vi.fn()

    // Session has relationship ID, but store is empty (new tab scenario)
    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: {
        id: 'session-123',
        coaching_relationship_id: 'rel-123'
      } as any,
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    vi.mocked(useCurrentCoachingRelationship).mockReturnValue({
      currentCoachingRelationshipId: null, // Empty store
      setCurrentCoachingRelationshipId: mockSetRelationshipId,
      currentCoachingRelationship: null,
      isLoading: false,
      isError: false,
      currentOrganizationId: 'org-123',
      resetCoachingRelationshipState: vi.fn(),
      refresh: mockRefresh,
    })

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    // Should call setCurrentCoachingRelationshipId with the session's relationship ID
    expect(mockSetRelationshipId).toHaveBeenCalledWith('rel-123')
    // Should call refresh to fetch the relationship data
    expect(mockRefresh).toHaveBeenCalled()
  })

  /**
   * Test: Switching Between Sessions with Different Relationships (Bug #228)
   *
   * Scenario: User navigates from Session A (rel-1) to Session B (rel-2)
   * Expected: Relationship ID should update from rel-1 to rel-2 AND refresh called
   * This is the primary fix for Bug #228
   */
  it('should update relationship ID when switching to session with different relationship', () => {
    const mockSetRelationshipId = vi.fn()
    const mockRefresh = vi.fn()

    // Session has relationship ID 'rel-456', but store has stale 'rel-123'
    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-456',
      currentCoachingSession: {
        id: 'session-456',
        coaching_relationship_id: 'rel-456' // Different relationship
      } as any,
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    vi.mocked(useCurrentCoachingRelationship).mockReturnValue({
      currentCoachingRelationshipId: 'rel-123', // Stale relationship from previous session
      setCurrentCoachingRelationshipId: mockSetRelationshipId,
      currentCoachingRelationship: null,
      isLoading: false,
      isError: false,
      currentOrganizationId: 'org-123',
      resetCoachingRelationshipState: vi.fn(),
      refresh: mockRefresh,
    })

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    // Should call setCurrentCoachingRelationshipId to update to the new relationship
    expect(mockSetRelationshipId).toHaveBeenCalledWith('rel-456')
    // Should call refresh to fetch the new relationship data (fixes stale cache bug)
    expect(mockRefresh).toHaveBeenCalled()
  })

  /**
   * Test: Same Relationship, Different Session
   *
   * Scenario: User navigates from Session A to Session B, both in the same relationship
   * Expected: setCurrentCoachingRelationshipId should NOT be called (optimization)
   * This ensures we don't trigger unnecessary updates
   */
  it('should not update relationship ID when switching to session with same relationship', () => {
    const mockSetRelationshipId = vi.fn()

    // Session and store both have the same relationship ID
    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-456',
      currentCoachingSession: {
        id: 'session-456',
        coaching_relationship_id: 'rel-123' // Same relationship
      } as any,
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    vi.mocked(useCurrentCoachingRelationship).mockReturnValue({
      currentCoachingRelationshipId: 'rel-123', // Same relationship already in store
      setCurrentCoachingRelationshipId: mockSetRelationshipId,
      currentCoachingRelationship: null,
      isLoading: false,
      isError: false,
      currentOrganizationId: 'org-123',
      resetCoachingRelationshipState: vi.fn(),
      refresh: vi.fn(),
    })

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    // Should NOT call setCurrentCoachingRelationshipId since they match
    expect(mockSetRelationshipId).not.toHaveBeenCalled()
  })

  /**
   * Test: Session Without Relationship ID
   *
   * Scenario: Session data is loaded but doesn't have a coaching_relationship_id
   * Expected: setCurrentCoachingRelationshipId should NOT be called
   * This handles edge cases where session data might be incomplete
   */
  it('should not update relationship ID when session has no relationship', () => {
    const mockSetRelationshipId = vi.fn()

    // Session without relationship ID
    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: {
        id: 'session-123',
        // No coaching_relationship_id
      } as any,
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    vi.mocked(useCurrentCoachingRelationship).mockReturnValue({
      currentCoachingRelationshipId: 'rel-123',
      setCurrentCoachingRelationshipId: mockSetRelationshipId,
      currentCoachingRelationship: null,
      isLoading: false,
      isError: false,
      currentOrganizationId: 'org-123',
      resetCoachingRelationshipState: vi.fn(),
      refresh: vi.fn(),
    })

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    // Should NOT call setCurrentCoachingRelationshipId
    expect(mockSetRelationshipId).not.toHaveBeenCalled()
  })

  /**
   * Test: Direct URL Access with Stale Store
   *
   * Scenario: User manually types a session URL while store has a different relationship
   * Expected: Relationship ID should update to match the session from the URL AND refresh called
   * This ensures URL is always the source of truth
   */
  it('should handle direct URL access with stale relationship ID in store', () => {
    const mockSetRelationshipId = vi.fn()
    const mockRefresh = vi.fn()

    // User types URL for session-789 which belongs to rel-789
    // But store has stale rel-123 from previous browsing
    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-789',
      currentCoachingSession: {
        id: 'session-789',
        coaching_relationship_id: 'rel-789'
      } as any,
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    vi.mocked(useCurrentCoachingRelationship).mockReturnValue({
      currentCoachingRelationshipId: 'rel-123', // Stale from previous session
      setCurrentCoachingRelationshipId: mockSetRelationshipId,
      currentCoachingRelationship: null,
      isLoading: false,
      isError: false,
      currentOrganizationId: 'org-123',
      resetCoachingRelationshipState: vi.fn(),
      refresh: mockRefresh,
    })

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    // Should update to match the URL-based session
    expect(mockSetRelationshipId).toHaveBeenCalledWith('rel-789')
    // Should call refresh to fetch the new relationship data
    expect(mockRefresh).toHaveBeenCalled()
  })
})