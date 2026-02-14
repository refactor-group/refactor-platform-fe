import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { ActionsList } from '@/components/ui/coaching-sessions/actions-list'
import { TestProviders } from '@/test-utils/providers'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ItemStatus } from '@/types/general'
import { DateTime } from 'ts-luxon'

/** Wraps children in both TestProviders and TooltipProvider */
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <TestProviders>
      <TooltipProvider>{children}</TooltipProvider>
    </TestProviders>
  )
}

// Mock user IDs for coach and coachee
const MOCK_COACH_ID = 'coach-123'
const MOCK_COACHEE_ID = 'coachee-456'
const MOCK_SESSION_ID = 'session-123'

// Mock actions for the current session
const mockSessionActions = [
  {
    id: 'action-1',
    coaching_session_id: MOCK_SESSION_ID,
    user_id: MOCK_COACH_ID,
    body: 'Complete project proposal',
    status: ItemStatus.InProgress,
    status_changed_at: DateTime.now(),
    due_by: DateTime.fromISO('2026-02-15'),
    created_at: DateTime.fromISO('2026-02-01'),
    updated_at: DateTime.now(),
    assignee_ids: [MOCK_COACH_ID],
  },
  {
    id: 'action-2',
    coaching_session_id: MOCK_SESSION_ID,
    user_id: MOCK_COACH_ID,
    body: 'Review quarterly goals',
    status: ItemStatus.Completed,
    status_changed_at: DateTime.now(),
    due_by: DateTime.fromISO('2026-02-20'),
    created_at: DateTime.fromISO('2026-02-02'),
    updated_at: DateTime.now(),
    assignee_ids: [MOCK_COACH_ID, MOCK_COACHEE_ID],
  },
  {
    id: 'action-3',
    coaching_session_id: MOCK_SESSION_ID,
    user_id: MOCK_COACHEE_ID,
    body: 'Unassigned task',
    status: ItemStatus.NotStarted,
    status_changed_at: DateTime.now(),
    due_by: DateTime.fromISO('2026-02-25'),
    created_at: DateTime.fromISO('2026-02-03'),
    updated_at: DateTime.now(),
    assignee_ids: [],
  },
]

const mockRefreshSession = vi.fn()
const mockRefreshAll = vi.fn()

vi.mock('@/lib/api/user-actions', () => ({
  useUserActionsList: vi.fn((userId: string, params: Record<string, unknown>) => {
    if (params?.coaching_session_id) {
      return {
        actions: mockSessionActions,
        isLoading: false,
        isError: false,
        refresh: mockRefreshSession,
      }
    }
    // All actions (for review filtering)
    return {
      actions: mockSessionActions,
      isLoading: false,
      isError: false,
      refresh: mockRefreshAll,
    }
  }),
}))

vi.mock('@/lib/api/coaching-sessions', () => ({
  useCoachingSessionList: vi.fn(() => ({
    coachingSessions: [],
    isLoading: false,
    isError: false,
  })),
}))

/**
 * Test Suite: Actions Card Stack — CRUD Operations & Checkbox Toggle
 *
 * Purpose: Validates the card-based ActionsList functionality including
 * rendering action cards, completion checkbox toggling, creating actions
 * via the ghost card, inline body editing, and deleting actions.
 */
describe('ActionsList', () => {
  const mockProps = {
    coachingSessionId: MOCK_SESSION_ID,
    coachingRelationshipId: 'rel-123',
    sessionDate: '2026-02-11',
    userId: 'user-123',
    locale: 'us',
    coachId: MOCK_COACH_ID,
    coachName: 'Coach Jane',
    coacheeId: MOCK_COACHEE_ID,
    coacheeName: 'Coachee John',
    isSaving: false,
    onActionAdded: vi.fn(),
    onActionEdited: vi.fn(),
    onActionDeleted: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockProps.onActionAdded.mockResolvedValue({
      id: 'new-action',
      coaching_session_id: MOCK_SESSION_ID,
      user_id: MOCK_COACH_ID,
      body: 'New action',
      status: ItemStatus.NotStarted,
      status_changed_at: DateTime.now(),
      due_by: DateTime.now(),
      created_at: DateTime.now(),
      updated_at: DateTime.now(),
      assignee_ids: [],
    })
    mockProps.onActionEdited.mockResolvedValue({
      id: 'action-1',
      coaching_session_id: MOCK_SESSION_ID,
      user_id: MOCK_COACH_ID,
      body: 'Updated action',
      status: ItemStatus.InProgress,
      status_changed_at: DateTime.now(),
      due_by: DateTime.now(),
      created_at: DateTime.now(),
      updated_at: DateTime.now(),
      assignee_ids: [MOCK_COACH_ID],
    })
    mockProps.onActionDeleted.mockResolvedValue({
      id: 'action-1',
      coaching_session_id: MOCK_SESSION_ID,
      user_id: MOCK_COACH_ID,
      body: '',
      status: ItemStatus.NotStarted,
      status_changed_at: DateTime.now(),
      due_by: DateTime.now(),
      created_at: DateTime.now(),
      updated_at: DateTime.now(),
      assignee_ids: [],
    })
  })

  /**
   * Asserts action card text and status pills render for all session actions
   */
  it('should render action cards with status pills', () => {
    render(
      <Wrapper>
        <ActionsList {...mockProps} />
      </Wrapper>
    )

    expect(screen.getByText('Complete project proposal')).toBeInTheDocument()
    expect(screen.getByText('Review quarterly goals')).toBeInTheDocument()
    expect(screen.getByText('Unassigned task')).toBeInTheDocument()
  })

  /**
   * Asserts "New Actions" section heading is present
   */
  it('should display the New Actions section heading', () => {
    render(
      <Wrapper>
        <ActionsList {...mockProps} />
      </Wrapper>
    )

    expect(screen.getByText('New Actions')).toBeInTheDocument()
  })

  /**
   * Asserts the "Actions for Review" collapsible section is present
   */
  it('should display the Actions for Review collapsible section', () => {
    render(
      <Wrapper>
        <ActionsList {...mockProps} />
      </Wrapper>
    )

    expect(screen.getByText('Actions for Review')).toBeInTheDocument()
  })

  /**
   * Asserts status pills render with correct text for each action
   */
  it('should render status pills with correct status text', () => {
    render(
      <Wrapper>
        <ActionsList {...mockProps} />
      </Wrapper>
    )

    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Not Started')).toBeInTheDocument()
  })

  /**
   * Asserts the ghost card "Add action" button is present and opens the creation form
   */
  it('should show the ghost card to add a new action', async () => {
    const user = userEvent.setup()

    render(
      <Wrapper>
        <ActionsList {...mockProps} />
      </Wrapper>
    )

    const addButton = screen.getByText('Add action')
    expect(addButton).toBeInTheDocument()

    await user.click(addButton)

    // Ghost card editing mode should show textarea
    await waitFor(() => {
      expect(screen.getByPlaceholderText('What needs to be done?')).toBeInTheDocument()
    })
  })

  /**
   * Asserts submitting the ghost card form calls onActionAdded
   */
  it('should create a new action via the ghost card', async () => {
    const user = userEvent.setup()

    render(
      <Wrapper>
        <ActionsList {...mockProps} />
      </Wrapper>
    )

    // Open the ghost card form
    await user.click(screen.getByText('Add action'))

    const textarea = await screen.findByPlaceholderText('What needs to be done?')
    await user.type(textarea, 'New test action')

    const addBtn = screen.getByRole('button', { name: 'Add' })
    await user.click(addBtn)

    await waitFor(() => {
      expect(mockProps.onActionAdded).toHaveBeenCalledWith(
        'New test action',
        ItemStatus.NotStarted,
        expect.any(DateTime),
        undefined // No assignees selected
      )
    })
  })

  /**
   * Asserts clicking the delete button and confirming calls onActionDeleted
   */
  it('should delete action when trash button is clicked and confirmed', async () => {
    const user = userEvent.setup()

    render(
      <Wrapper>
        <ActionsList {...mockProps} />
      </Wrapper>
    )

    // Find trash buttons by their icon-sized ghost variant styling
    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.classList.contains('hover:text-destructive')
    )
    expect(deleteButtons.length).toBeGreaterThan(0)
    await user.click(deleteButtons[0])

    // Confirmation dialog should appear
    const confirmButton = await screen.findByRole('button', { name: 'Delete' })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(mockProps.onActionDeleted).toHaveBeenCalled()
    })
  })

  /**
   * Asserts clicking cancel in the delete confirmation does NOT delete the action
   */
  it('should not delete action when cancel is clicked in confirmation dialog', async () => {
    const user = userEvent.setup()

    render(
      <Wrapper>
        <ActionsList {...mockProps} />
      </Wrapper>
    )

    // Find trash buttons by their icon-sized ghost variant styling
    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.classList.contains('hover:text-destructive')
    )
    expect(deleteButtons.length).toBeGreaterThan(0)
    await user.click(deleteButtons[0])

    // Confirmation dialog should appear — click Cancel
    const cancelButton = await screen.findByRole('button', { name: 'Cancel' })
    await user.click(cancelButton)

    expect(mockProps.onActionDeleted).not.toHaveBeenCalled()
  })

  /**
   * Asserts inline body editing: click text -> textarea -> blur saves
   */
  it('should allow inline editing of action body text', async () => {
    const user = userEvent.setup()

    render(
      <Wrapper>
        <ActionsList {...mockProps} />
      </Wrapper>
    )

    // Click the action body text to enter edit mode
    const bodyText = screen.getByText('Complete project proposal')
    await user.click(bodyText)

    // Should now show a textarea with the action body
    const textarea = screen.getByDisplayValue('Complete project proposal')
    expect(textarea).toBeInTheDocument()

    // Edit the text and blur to save
    await user.clear(textarea)
    await user.type(textarea, 'Updated proposal text')
    fireEvent.blur(textarea)

    await waitFor(() => {
      expect(mockProps.onActionEdited).toHaveBeenCalledWith(
        'action-1',
        'Updated proposal text',
        ItemStatus.InProgress,
        mockSessionActions[0].due_by,
        mockSessionActions[0].assignee_ids
      )
    })
  })

  /**
   * Asserts empty state message when no session actions exist
   */
  it('should show empty state when there are no session actions', async () => {
    const mod = await import('@/lib/api/user-actions') as {
      useUserActionsList: ReturnType<typeof vi.fn>
    }
    mod.useUserActionsList.mockImplementation(() => ({
      actions: [],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    }))

    render(
      <Wrapper>
        <ActionsList {...mockProps} />
      </Wrapper>
    )

    expect(screen.getByText('No actions yet for this session.')).toBeInTheDocument()

    // Restore original mock for subsequent tests
    mod.useUserActionsList.mockImplementation(
      (userId: string, params: Record<string, unknown>) => {
        if (params?.coaching_session_id) {
          return {
            actions: mockSessionActions,
            isLoading: false,
            isError: false,
            refresh: mockRefreshSession,
          }
        }
        return {
          actions: mockSessionActions,
          isLoading: false,
          isError: false,
          refresh: mockRefreshAll,
        }
      }
    )
  })

  /**
   * Asserts "All caught up" empty state in the review section
   */
  it('should show "All caught up" when there are no review actions', () => {
    render(
      <Wrapper>
        <ActionsList {...mockProps} />
      </Wrapper>
    )

    // Open the review section
    fireEvent.click(screen.getByText('Actions for Review'))

    expect(screen.getByText('All caught up')).toBeInTheDocument()
  })

  /**
   * Asserts that completed actions have reduced opacity
   */
  it('should show completed actions with reduced opacity', () => {
    render(
      <Wrapper>
        <ActionsList {...mockProps} />
      </Wrapper>
    )

    const completedCard = screen.getByText('Review quarterly goals').closest('[class*="card"]')!
    expect(completedCard.className).toContain('opacity-60')
  })

})
