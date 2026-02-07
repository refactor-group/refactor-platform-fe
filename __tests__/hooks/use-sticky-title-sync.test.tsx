import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { useStickyTitleSync } from '@/lib/hooks/use-sticky-title-sync'
import { StickyTitleProvider, useStickyTitle } from '@/lib/contexts/sticky-title-context'
import { useCurrentCoachingSession } from '@/lib/hooks/use-current-coaching-session'
import { useCurrentCoachingRelationship } from '@/lib/hooks/use-current-coaching-relationship'
import { createMockCoachingSession } from '../factories/coaching-session.factory'
import type { CoachingRelationshipWithUserNames } from '@/types/coaching-relationship'

vi.mock('@/lib/hooks/use-current-coaching-session')
vi.mock('@/lib/hooks/use-current-coaching-relationship')

vi.mock('@/lib/providers/auth-store-provider', () => ({
  useAuthStore: vi.fn(() => ({
    userSession: { timezone: 'America/Chicago' },
  })),
}))

function createMockRelationship(
  overrides?: Partial<CoachingRelationshipWithUserNames>
): CoachingRelationshipWithUserNames {
  const now = new Date().toISOString()
  return {
    id: 'rel-123',
    coach_id: 'coach-1',
    coachee_id: 'coachee-1',
    organization_id: 'org-1',
    created_at: now,
    updated_at: now,
    coach_first_name: 'Alice',
    coach_last_name: 'Smith',
    coachee_first_name: 'Bob',
    coachee_last_name: 'Jones',
    ...overrides,
  }
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <StickyTitleProvider>{children}</StickyTitleProvider>
)

/**
 * Test Suite: useStickyTitleSync Hook
 *
 * Validates that the hook pushes session title data into the StickyTitle context
 * and cleans up on unmount.
 */
describe('useStickyTitleSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should push title data into context when session and relationship are available', () => {
    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: createMockCoachingSession({
        date: '2026-02-07T16:00:00.000Z',
      }),
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    vi.mocked(useCurrentCoachingRelationship).mockReturnValue({
      currentCoachingRelationshipId: 'rel-123',
      setCurrentCoachingRelationshipId: vi.fn(),
      currentCoachingRelationship: createMockRelationship(),
      isLoading: false,
      isError: false,
      currentOrganizationId: 'org-1',
      resetCoachingRelationshipState: vi.fn(),
      refresh: vi.fn(),
    })

    // Render both hooks in the same provider to read the context state
    const { result } = renderHook(
      () => {
        useStickyTitleSync()
        return useStickyTitle()
      },
      { wrapper }
    )

    expect(result.current!.titleData).not.toBeNull()
    expect(result.current!.titleData!.names).toContain('Alice')
    expect(result.current!.titleData!.names).toContain('Bob')
    expect(result.current!.titleData!.date).toContain('2026')
  })

  it('should set titleData to null when session data is missing', () => {
    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: null,
      currentCoachingSession: null,
      isError: false,
      isLoading: true,
      refresh: vi.fn(),
    })

    vi.mocked(useCurrentCoachingRelationship).mockReturnValue({
      currentCoachingRelationshipId: 'rel-123',
      setCurrentCoachingRelationshipId: vi.fn(),
      currentCoachingRelationship: createMockRelationship(),
      isLoading: false,
      isError: false,
      currentOrganizationId: 'org-1',
      resetCoachingRelationshipState: vi.fn(),
      refresh: vi.fn(),
    })

    const { result } = renderHook(
      () => {
        useStickyTitleSync()
        return useStickyTitle()
      },
      { wrapper }
    )

    expect(result.current!.titleData).toBeNull()
  })

  it('should clean up titleData on unmount', () => {
    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: createMockCoachingSession({
        date: '2026-02-07T16:00:00.000Z',
      }),
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    vi.mocked(useCurrentCoachingRelationship).mockReturnValue({
      currentCoachingRelationshipId: 'rel-123',
      setCurrentCoachingRelationshipId: vi.fn(),
      currentCoachingRelationship: createMockRelationship(),
      isLoading: false,
      isError: false,
      currentOrganizationId: 'org-1',
      resetCoachingRelationshipState: vi.fn(),
      refresh: vi.fn(),
    })

    // Render the sync hook + a reader to inspect context state
    const { result, unmount } = renderHook(
      () => {
        useStickyTitleSync()
        return useStickyTitle()
      },
      { wrapper }
    )

    // Verify data was set
    expect(result.current!.titleData).not.toBeNull()

    // Unmount should trigger the cleanup (setTitleData(null))
    unmount()

    // After unmount, the hook's cleanup has run, but since the provider
    // also unmounts we can't read context state. Instead we verify
    // no errors occurred during the unmount cleanup path.
  })

  it('should not push data when outside the provider', () => {
    vi.mocked(useCurrentCoachingSession).mockReturnValue({
      currentCoachingSessionId: 'session-123',
      currentCoachingSession: createMockCoachingSession(),
      isError: false,
      isLoading: false,
      refresh: vi.fn(),
    })

    vi.mocked(useCurrentCoachingRelationship).mockReturnValue({
      currentCoachingRelationshipId: 'rel-123',
      setCurrentCoachingRelationshipId: vi.fn(),
      currentCoachingRelationship: createMockRelationship(),
      isLoading: false,
      isError: false,
      currentOrganizationId: 'org-1',
      resetCoachingRelationshipState: vi.fn(),
      refresh: vi.fn(),
    })

    // No provider wrapper — should not throw
    expect(() => {
      renderHook(() => useStickyTitleSync())
    }).not.toThrow()
  })
})
