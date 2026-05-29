import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRouter, useParams, useSearchParams, usePathname } from 'next/navigation'
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
  usePathname: vi.fn(),
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

// Lightweight JoinMeetingButton stand-in: disabled placeholder when no meetingUrl,
// enabled button when provided. Real component pulls in DropdownMenu/AlertDialog
// internals not relevant to page-level layout/auto-sync tests.
vi.mock('@/components/ui/coaching-sessions/join-meeting-button', () => ({
  JoinMeetingButton: ({ meetingUrl }: { meetingUrl?: string }) =>
    meetingUrl
      ? <button data-testid="join-meeting-button">Join Meeting</button>
      : <button disabled data-testid="join-meeting-button">Join Meeting</button>,
}))

// Page-level toast hook is mounted but not under test here.
vi.mock('@/lib/hooks/use-transcription-toasts', () => ({
  useTranscriptionToasts: () => undefined,
}))

// Page reads recording/transcription status for the header indicator.
// Default to no live state; individual tests can override if needed.
vi.mock('@/lib/api/meeting-recordings', () => ({
  useMeetingRecording: () => ({ recording: null }),
}))
vi.mock('@/lib/api/transcriptions', () => ({
  useTranscription: () => ({ transcription: null }),
  useTranscriptionSegments: () => ({ segments: [], isLoading: false, isError: undefined }),
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
  CoachingSessionPanel: ({ readOnly, noteSelection }: any) => (
    <div
      data-testid="coaching-session-panel"
      data-readonly={String(!!readOnly)}
      data-draft-section={noteSelection?.some ? noteSelection.val.section : ''}
      data-draft-text={noteSelection?.some ? noteSelection.val.text : ''}
    >Goals</div>
  )
}))

vi.mock('@/components/ui/coaching-sessions/coaching-tabs-container', () => ({
  CoachingTabsContainer: ({ onAddFromNote }: any) => (
    <div data-testid="coaching-tabs-container">
      <button
        data-testid="trigger-add-action"
        onClick={() => onAddFromNote('actions', '  Hello from the notes  ')}
      >Add as action</button>
      <button
        data-testid="trigger-add-agreement"
        onClick={() => onAddFromNote('agreements', 'Weekly retro every Friday')}
      >Add as agreement</button>
      <button
        data-testid="trigger-add-goal"
        onClick={() => onAddFromNote('goals', 'Ship the onboarding revamp')}
      >Add as goal</button>
      <button
        data-testid="trigger-add-blank"
        onClick={() => onAddFromNote('actions', '   ')}
      >Add from blank note</button>
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
    ;(usePathname as any).mockReturnValue('/coaching-sessions/session-123')
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
    ;(usePathname as any).mockReturnValue('/coaching-sessions/session-123')
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

    const button = screen.getByTestId('join-meeting-button')
    expect(button).toBeDisabled()
  })

  it('shows an enabled join button when a meeting URL is set', () => {
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

    const button = screen.getByTestId('join-meeting-button')
    expect(button).not.toBeDisabled()
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
    ;(usePathname as any).mockReturnValue('/coaching-sessions/session-123')

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

    const goalPanel = screen.getByTestId('coaching-session-panel')
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

    const goalPanel = screen.getByTestId('coaching-session-panel')
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

    const goalPanel = screen.getByTestId('coaching-session-panel')
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

    const goalPanel = screen.getByTestId('coaching-session-panel')
    expect(goalPanel).toHaveAttribute('data-readonly', 'false')
  })
})

/**
 * Test Suite: Layout panel visibility across URL states
 *
 * Purpose: Asserts that the page renders / hides the transcript panel
 * correctly across the layout URL states. These tests guard the bug fix
 * for "open transcript → maximize notes → restore leaves transcript
 * hidden": the fix relies on the notes-maximize toggle preserving
 * `?transcript=1` in the URL, and this suite confirms the page renders
 * the correct panels for each URL variant.
 */
describe('CoachingSessionsPage - Panel visibility across URL states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue({ push: vi.fn(), replace: vi.fn() })
    ;(useParams as any).mockReturnValue({ id: 'session-123' })
    ;(usePathname as any).mockReturnValue('/coaching-sessions/session-123')
    mockRoleAsCoach()

    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: createMockCoachingSession({
        id: 'session-123',
        coaching_relationship_id: 'rel-123',
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

  it('renders the transcript panel when ?transcript=1', () => {
    ;(useSearchParams as any).mockReturnValue(new URLSearchParams('transcript=1'))
    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )
    expect(screen.getByRole('heading', { name: 'Transcript' })).toBeInTheDocument()
    expect(screen.getByTestId('coaching-tabs-container')).toBeInTheDocument()
  })

  it('hides the transcript panel while Notes is maximized, even if ?transcript=1 is still set', () => {
    // This is the critical state: transcript was open, user maximized notes,
    // URL preserved transcript=1 so restoring brings the transcript back.
    ;(useSearchParams as any).mockReturnValue(
      new URLSearchParams('transcript=1&focus=notes')
    )
    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )
    expect(screen.queryByRole('heading', { name: 'Transcript' })).not.toBeInTheDocument()
    expect(screen.getByTestId('coaching-tabs-container')).toBeInTheDocument()
  })

  it('re-renders the transcript panel after unmaximizing Notes (?transcript=1 preserved)', () => {
    // Simulates the URL state that toggleNotesMaximized writes when
    // restoring from a notes-maximize with transcript still open.
    ;(useSearchParams as any).mockReturnValue(new URLSearchParams('transcript=1'))
    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )
    expect(screen.getByRole('heading', { name: 'Transcript' })).toBeInTheDocument()
  })

  it('hides Notes when the transcript is maximized', () => {
    ;(useSearchParams as any).mockReturnValue(
      new URLSearchParams('transcript=1&focus=transcript')
    )
    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )
    expect(screen.getByRole('heading', { name: 'Transcript' })).toBeInTheDocument()
    expect(screen.queryByTestId('coaching-tabs-container')).not.toBeInTheDocument()
  })

  it('shows neither focus panel in the default state', () => {
    ;(useSearchParams as any).mockReturnValue(new URLSearchParams())
    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )
    expect(screen.queryByRole('heading', { name: 'Transcript' })).not.toBeInTheDocument()
    expect(screen.getByTestId('coaching-tabs-container')).toBeInTheDocument()
    expect(screen.getByTestId('coaching-session-panel')).toBeInTheDocument()
  })
})

/**
 * Test Suite: Add from notes selection
 *
 * Validates the page-level bridge from the notes "Add as …" affordance: the
 * selected text is trimmed and handed to the panel as a NoteSelection carrying
 * its target section, and (when the panel is already expanded) the URL is
 * pinned to panel=<section>. One mechanism, all three entity sections.
 */
describe('CoachingSessionsPage - Add from notes selection', () => {
  const mockReplace = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as any).mockReturnValue({ push: vi.fn(), replace: mockReplace })
    ;(useParams as any).mockReturnValue({ id: 'session-123' })
    ;(useSearchParams as any).mockReturnValue(new URLSearchParams())
    ;(usePathname as any).mockReturnValue('/coaching-sessions/session-123')
    mockRoleAsCoach()

    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: createMockCoachingSession({
        id: 'session-123',
        coaching_relationship_id: 'rel-123',
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

  it.each([
    { testId: 'trigger-add-action', section: 'actions', text: 'Hello from the notes' },
    { testId: 'trigger-add-agreement', section: 'agreements', text: 'Weekly retro every Friday' },
    { testId: 'trigger-add-goal', section: 'goals', text: 'Ship the onboarding revamp' },
  ])(
    'passes the trimmed selection to the panel and pins panel=$section in the URL',
    async ({ testId, section, text }) => {
      const user = userEvent.setup()
      render(
        <TestProviders>
          <CoachingSessionsPage />
        </TestProviders>
      )

      await user.click(screen.getByTestId(testId))

      // Trim guard + correct section/text handed to the panel.
      const panel = screen.getByTestId('coaching-session-panel')
      expect(panel.getAttribute('data-draft-section')).toBe(section)
      expect(panel.getAttribute('data-draft-text')).toBe(text)

      // Panel is expanded by default, so the deferred URL sync fires. Goals is
      // the default section, so its param is removed to keep the URL clean;
      // the other two pin panel=<section>.
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(
          section === 'goals'
            ? expect.not.stringContaining('panel=')
            : expect.stringContaining(`panel=${section}`),
          expect.objectContaining({ scroll: false })
        )
      })
    }
  )

  it('ignores a whitespace-only selection (no draft, no URL change)', async () => {
    const user = userEvent.setup()
    render(
      <TestProviders>
        <CoachingSessionsPage />
      </TestProviders>
    )

    await user.click(screen.getByTestId('trigger-add-blank'))

    // Guard bails before setting a draft or touching the URL.
    expect(
      screen.getByTestId('coaching-session-panel').getAttribute('data-draft-text')
    ).toBe('')
    expect(mockReplace).not.toHaveBeenCalledWith(
      expect.stringContaining('panel='),
      expect.anything()
    )
  })
})
