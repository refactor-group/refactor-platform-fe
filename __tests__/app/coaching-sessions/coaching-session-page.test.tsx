import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import CoachingSessionsPage from '@/app/coaching-sessions/[id]/page'
import { TestProviders } from '@/test-utils/providers'
import { useCurrentCoachingSession } from '@/lib/hooks/use-current-coaching-session'
import { useCurrentCoachingRelationship } from '@/lib/hooks/use-current-coaching-relationship'
import { useCurrentRelationshipRole } from '@/lib/hooks/use-current-relationship-role'
import { createMockCoachingSession } from '../../factories/coaching-session.factory'
import { None, Some } from '@/types/option'
import { RelationshipRole } from '@/types/relationship-role'

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
  useSearchParams: vi.fn(),
}))

// Mock the coaching session hooks
vi.mock('@/lib/hooks/use-current-coaching-session')
vi.mock('@/lib/hooks/use-current-coaching-relationship')
vi.mock('@/lib/hooks/use-current-relationship-role')

// Mock auth store
vi.mock('@/lib/providers/auth-store-provider', () => ({
  useAuthStore: vi.fn(() => ({
    userId: 'user-123',
    isLoggedIn: true,
  })),
  AuthStoreProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Lightweight JoinMeetLink stand-in: disabled placeholder when no meetUrl, link when provided
vi.mock('@/components/ui/coaching-sessions/join-meet-link', () => ({
  default: ({ meetUrl }: { meetUrl?: string }) =>
    meetUrl
      ? <a href={meetUrl} data-testid="join-meet-link">Join</a>
      : <button disabled data-testid="join-meet-link">Join</button>,
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

vi.mock('@/lib/hooks/use-sidebar', () => ({
  useSidebar: () => ({
    collapse: vi.fn(),
    expand: vi.fn(),
    state: 'expanded',
  }),
}))

vi.mock('@/components/ui/coaching-sessions/coaching-session-panel', () => ({
  CoachingSessionPanel: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="goal-panel" data-readonly={String(!!readOnly)}>Goals</div>
  )
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

// Helper to mock role hook with sensible defaults
function mockRoleAsCoach() {
  vi.mocked(useCurrentRelationshipRole).mockReturnValue({
    relationship_role: Some(RelationshipRole.Coach),
    isCoachInCurrentRelationship: true,
    isCoacheeInCurrentRelationship: false,
    hasActiveRelationship: true,
    relationshipId: 'rel-123',
    userId: 'user-123',
    coachId: 'user-123',
    coacheeId: 'coachee-456',
  })
}

function mockRoleAsCoachee() {
  vi.mocked(useCurrentRelationshipRole).mockReturnValue({
    relationship_role: Some(RelationshipRole.Coachee),
    isCoachInCurrentRelationship: false,
    isCoacheeInCurrentRelationship: true,
    hasActiveRelationship: true,
    relationshipId: 'rel-123',
    userId: 'coachee-456',
    coachId: 'user-123',
    coacheeId: 'coachee-456',
  })
}

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
  } as const

  const mockParams = {
    id: 'session-123'
  } as const

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue(mockRouter)
    ;(useParams as any).mockReturnValue(mockParams)
    mockRoleAsCoach()

    // Set default mocks for relationship hooks
    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: createMockCoachingSession({
        id: 'session-123',
        coaching_relationship_id: 'rel-123'
      }),
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
    const mockSearchParams = new URLSearchParams('tab=actions')
    ;(useSearchParams as any).mockReturnValue(mockSearchParams)

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    expect(screen.getByTestId('current-tab')).toHaveTextContent('actions')
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
  } as const

  const mockParams = {
    id: 'session-123'
  } as const

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue(mockRouter)
    ;(useParams as any).mockReturnValue(mockParams)
    ;(useSearchParams as any).mockReturnValue(new URLSearchParams())
    mockRoleAsCoach()
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
      currentCoachingSession: createMockCoachingSession({
        id: 'session-123',
        coaching_relationship_id: 'rel-123'
      }),
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
      currentCoachingSession: createMockCoachingSession({
        id: 'session-456',
        coaching_relationship_id: 'rel-456' // Different relationship
      }),
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
      currentCoachingSession: createMockCoachingSession({
        id: 'session-456',
        coaching_relationship_id: 'rel-123' // Same relationship
      }),
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
      currentCoachingSession: createMockCoachingSession({
        id: 'session-123',
        coaching_relationship_id: undefined as any // No coaching_relationship_id
      }),
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
      currentCoachingSession: createMockCoachingSession({
        id: 'session-789',
        coaching_relationship_id: 'rel-789'
      }),
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

/**
 * Test Suite: Join Meet Link visibility
 *
 * Purpose: Validates that the join meet button is shown to all users (coaches and coachees
 * alike) in two states: disabled when no meeting URL is set, and enabled when one is.
 */
describe('CoachingSessionsPage - Join meet link visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue({ push: vi.fn(), replace: vi.fn() })
    ;(useParams as any).mockReturnValue({ id: 'session-123' })
    ;(useSearchParams as any).mockReturnValue(new URLSearchParams())
    mockRoleAsCoach()

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

  it('shows a disabled join button when no meeting URL is set', () => {
    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: createMockCoachingSession({ id: 'session-123' }),
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    const button = screen.getByTestId('join-meet-link')
    expect(button).toBeDisabled()
  })

  it('shows an enabled join link when a meeting URL is set', () => {
    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: createMockCoachingSession({
        id: 'session-123',
        meeting_url: 'https://meet.google.com/abc-defg-hij',
      }),
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    const link = screen.getByTestId('join-meet-link')
    expect(link).not.toBeDisabled()
  })
})

/**
 * Test Suite: Goal Panel readOnly behavior based on role and session timing
 *
 * Purpose: Validates that coaches can add/remove goals on past sessions
 * while coachees cannot. Both roles should have full access on current sessions.
 */
describe('CoachingSessionsPage - Goal panel readOnly by role', () => {
  // A date far in the past so isPastSession always returns true
  const pastDate = '2020-01-01T10:00:00.000Z'
  // A date far in the future so isPastSession always returns false
  const futureDate = '2099-12-31T10:00:00.000Z'

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue({ push: vi.fn(), replace: vi.fn() })
    ;(useParams as any).mockReturnValue({ id: 'session-123' })
    ;(useSearchParams as any).mockReturnValue(new URLSearchParams())

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

  it('passes readOnly={false} to GoalPanel when coach views a past session', () => {
    mockRoleAsCoach()

    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: createMockCoachingSession({
        id: 'session-123',
        coaching_relationship_id: 'rel-123',
        date: pastDate,
      }),
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    const goalPanel = screen.getByTestId('goal-panel')
    expect(goalPanel).toHaveAttribute('data-readonly', 'false')
  })

  it('passes readOnly={true} to GoalPanel when coachee views a past session', () => {
    mockRoleAsCoachee()

    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: createMockCoachingSession({
        id: 'session-123',
        coaching_relationship_id: 'rel-123',
        date: pastDate,
      }),
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    const goalPanel = screen.getByTestId('goal-panel')
    expect(goalPanel).toHaveAttribute('data-readonly', 'true')
  })

  it('passes readOnly={false} to GoalPanel when coach views a current session', () => {
    mockRoleAsCoach()

    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: createMockCoachingSession({
        id: 'session-123',
        coaching_relationship_id: 'rel-123',
        date: futureDate,
      }),
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    const goalPanel = screen.getByTestId('goal-panel')
    expect(goalPanel).toHaveAttribute('data-readonly', 'false')
  })

  it('passes readOnly={false} to GoalPanel when coachee views a current session', () => {
    mockRoleAsCoachee()

    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: createMockCoachingSession({
        id: 'session-123',
        coaching_relationship_id: 'rel-123',
        date: futureDate,
      }),
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    const goalPanel = screen.getByTestId('goal-panel')
    expect(goalPanel).toHaveAttribute('data-readonly', 'false')
  })
})
