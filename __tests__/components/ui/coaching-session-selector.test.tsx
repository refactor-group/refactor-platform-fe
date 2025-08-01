import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DateTime } from 'ts-luxon'
import CoachingSessionSelector from '@/components/ui/coaching-session-selector'
import { TestProviders } from '@/test-utils/providers'

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

vi.mock('@/lib/api/coaching-sessions', () => ({
  useCoachingSessionList: vi.fn(),
}))

vi.mock('@/lib/hooks/use-current-coaching-session', () => ({
  useCurrentCoachingSession: vi.fn(() => ({
    currentCoachingSessionId: null,
    currentCoachingSession: null,
    isLoading: false,
  })),
}))

vi.mock('@/lib/api/overarching-goals', () => ({
  useOverarchingGoalBySession: vi.fn(() => ({
    overarchingGoal: { title: 'Test Goal' },
    isLoading: false,
    isError: false,
  })),
}))

vi.mock('@/lib/providers/auth-store-provider', () => ({
  useAuthStore: vi.fn(() => ({
    userSession: { timezone: 'America/Chicago' },
  })),
  AuthStoreProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/timezone-utils', () => ({
  formatDateInUserTimezone: (date: string) => `Formatted: ${date}`,
  getBrowserTimezone: () => 'America/Chicago',
}))

vi.mock('@/types/general', () => ({
  getDateTimeFromString: (dateStr: string) => DateTime.fromISO(dateStr),
}))

import { useCoachingSessionList } from '@/lib/api/coaching-sessions'

describe('CoachingSessionSelector - Sorting & Grouping', () => {
  const relationshipId = 'rel-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call API with correct sorting parameters (date desc)', () => {
    vi.mocked(useCoachingSessionList).mockReturnValue({
      coachingSessions: [],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    })

    render(
      <TestProviders>
        <CoachingSessionSelector 
          relationshipId={relationshipId} 
          disabled={false} 
        />
      </TestProviders>
    )

    // Verify backend sorting is requested: date desc (newest first)
    expect(useCoachingSessionList).toHaveBeenCalledWith(
      relationshipId,
      expect.any(Object), // fromDate
      expect.any(Object), // toDate  
      'date',             // sortBy
      'desc'              // sortOrder - newest first
    )
  })

  it('should display "Upcoming Sessions" first, then "Previous Sessions"', () => {
    const now = DateTime.now()
    const sessions = [
      {
        id: 'upcoming-1',
        date: now.plus({ days: 1 }).toISO(),
        coaching_relationship_id: relationshipId,
      },
      {
        id: 'previous-1',
        date: now.minus({ days: 1 }).toISO(),
        coaching_relationship_id: relationshipId,
      },
    ]

    vi.mocked(useCoachingSessionList).mockReturnValue({
      coachingSessions: sessions,
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    })

    render(
      <TestProviders>
        <CoachingSessionSelector 
          relationshipId={relationshipId} 
          disabled={false} 
        />
      </TestProviders>
    )

    // Open dropdown
    fireEvent.click(screen.getByRole('combobox'))

    // Check group order: Upcoming first, Previous second
    const labels = screen.getAllByText(/Sessions$/)
    expect(labels[0]).toHaveTextContent('Upcoming Sessions')
    expect(labels[1]).toHaveTextContent('Previous Sessions')
  })

  it('should show indented sessions under group headers', () => {
    const now = DateTime.now()
    const sessions = [
      {
        id: 'upcoming-1',
        date: now.plus({ days: 1 }).toISO(),
        coaching_relationship_id: relationshipId,
      },
    ]

    vi.mocked(useCoachingSessionList).mockReturnValue({
      coachingSessions: sessions,
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    })

    render(
      <TestProviders>
        <CoachingSessionSelector 
          relationshipId={relationshipId} 
          disabled={false} 
        />
      </TestProviders>
    )

    // Open dropdown
    fireEvent.click(screen.getByRole('combobox'))

    // Verify session items have indentation class
    const sessionOptions = screen.getAllByRole('option')
    sessionOptions.forEach(option => {
      expect(option).toHaveClass('pl-8') // Indentation class
    })
  })
})