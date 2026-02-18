import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { ActionsPanel } from '@/components/ui/coaching-sessions/actions-panel'
import { TestProviders } from '@/test-utils/providers'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ItemStatus, EntityApiError } from '@/types/general'
import { useUserActionsList } from '@/lib/api/user-actions'
import type { UserActionsQueryParams } from '@/lib/api/user-actions'
import { DateTime } from 'ts-luxon'
import { toast } from 'sonner'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: string }) => children,
}))

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneLight: {},
  oneDark: {},
}))

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

// Actions from a previous session in the same relationship (for review filtering)
const PREVIOUS_SESSION_ID = 'session-prev-456'
const mockAllRelationshipActions = [
  ...mockSessionActions,
  {
    id: 'action-prev-1',
    coaching_session_id: PREVIOUS_SESSION_ID,
    user_id: MOCK_COACH_ID,
    body: 'Follow up on last session goals',
    status: ItemStatus.InProgress,
    status_changed_at: DateTime.now(),
    due_by: DateTime.fromISO('2026-02-08'),
    created_at: DateTime.fromISO('2026-01-28'),
    updated_at: DateTime.now(),
    assignee_ids: [MOCK_COACHEE_ID],
  },
]

const mockRefreshSession = vi.fn()
const mockRefreshAll = vi.fn()

vi.mock('@/lib/api/user-actions', () => ({
  useUserActionsList: vi.fn((userId: string, params: UserActionsQueryParams) => {
    if (params?.coaching_session_id) {
      return {
        actions: mockSessionActions,
        isLoading: false,
        isError: false,
        refresh: mockRefreshSession,
      }
    }
    // All actions scoped by coaching_relationship_id (for review filtering)
    return {
      actions: mockAllRelationshipActions,
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
 * Purpose: Validates the card-based actions panel functionality including
 * rendering action cards, completion checkbox toggling, creating actions
 * via the new action card, inline body editing, and deleting actions.
 */
describe('ActionsPanel', () => {
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
   * Regression test for bug #289: Actions for Review must be scoped to the
   * current coaching relationship. Without coaching_relationship_id on the
   * allActions API call, actions from OTHER relationships leak into the
   * review section.
   *
   * This test sets up a cross-relationship action that would appear in the
   * review section if relationship scoping were missing. The mock returns
   * different data depending on whether coaching_relationship_id is provided,
   * simulating the backend's filtering behavior.
   */
  it('should only show review actions from the current coaching relationship (bug #289)', () => {
    // Action from a DIFFERENT coaching relationship — this is the bug scenario.
    // If the API call lacks coaching_relationship_id, this action leaks through.
    const OTHER_RELATIONSHIP_SESSION_ID = 'session-other-rel-789'
    const crossRelationshipAction = {
      id: 'action-leaked',
      coaching_session_id: OTHER_RELATIONSHIP_SESSION_ID,
      user_id: MOCK_COACH_ID,
      body: 'Leaked action from other relationship',
      status: ItemStatus.InProgress,
      status_changed_at: DateTime.now(),
      due_by: DateTime.fromISO('2026-02-09'),
      created_at: DateTime.fromISO('2026-01-25'),
      updated_at: DateTime.now(),
      assignee_ids: [MOCK_COACH_ID],
    }

    const mockedHook = vi.mocked(useUserActionsList)
    mockedHook.mockImplementation((_userId, params) => {
      if (params?.coaching_session_id) {
        return {
          actions: mockSessionActions,
          isLoading: false,
          isError: false,
          refresh: mockRefreshSession,
        }
      }
      // Simulate backend behavior: if coaching_relationship_id is provided,
      // return only that relationship's actions. Otherwise return everything.
      if (params?.coaching_relationship_id === mockProps.coachingRelationshipId) {
        return {
          actions: mockAllRelationshipActions,
          isLoading: false,
          isError: false,
          refresh: mockRefreshAll,
        }
      }
      // No relationship scoping → ALL actions including cross-relationship ones
      return {
        actions: [...mockAllRelationshipActions, crossRelationshipAction],
        isLoading: false,
        isError: false,
        refresh: mockRefreshAll,
      }
    })

    render(
      <Wrapper>
        <ActionsPanel {...mockProps} />
      </Wrapper>
    )

    // Open the review section
    fireEvent.click(screen.getByText('Actions for Review'))

    // Same-relationship action from a previous session SHOULD appear
    expect(screen.getByText('Follow up on last session goals')).toBeInTheDocument()

    // Cross-relationship action MUST NOT appear (this was the bug)
    expect(screen.queryByText('Leaked action from other relationship')).not.toBeInTheDocument()

    // Also verify the parameter was sent correctly
    const allActionsCalls = mockedHook.mock.calls.filter(
      ([_userId, params]) => !params?.coaching_session_id
    )
    expect(allActionsCalls.length).toBeGreaterThan(0)
    expect(allActionsCalls[0][1]).toMatchObject({
      coaching_relationship_id: mockProps.coachingRelationshipId,
    })

    // Restore default mock for subsequent tests
    mockedHook.mockImplementation((_userId, params) => {
      if (params?.coaching_session_id) {
        return {
          actions: mockSessionActions,
          isLoading: false,
          isError: false,
          refresh: mockRefreshSession,
        }
      }
      return {
        actions: mockAllRelationshipActions,
        isLoading: false,
        isError: false,
        refresh: mockRefreshAll,
      }
    })
  })

  /**
   * Asserts action card text and status pills render for all session actions
   */
  it('should render action cards with status pills', () => {
    render(
      <Wrapper>
        <ActionsPanel {...mockProps} />
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
        <ActionsPanel {...mockProps} />
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
        <ActionsPanel {...mockProps} />
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
        <ActionsPanel {...mockProps} />
      </Wrapper>
    )

    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Not Started')).toBeInTheDocument()
  })

  /**
   * Asserts the new action card "Add action" button is present and opens the creation form
   */
  it('should show the new action card to add a new action', async () => {
    const user = userEvent.setup()

    render(
      <Wrapper>
        <ActionsPanel {...mockProps} />
      </Wrapper>
    )

    const addButton = screen.getByText('Add action')
    expect(addButton).toBeInTheDocument()

    await user.click(addButton)

    // New action card editing mode should show textarea
    await waitFor(() => {
      expect(screen.getByPlaceholderText('What needs to be done?')).toBeInTheDocument()
    })
  })

  /**
   * Asserts submitting the new action card form calls onActionAdded
   */
  it('should create a new action via the new action card', async () => {
    const user = userEvent.setup()

    render(
      <Wrapper>
        <ActionsPanel {...mockProps} />
      </Wrapper>
    )

    // Open the new action card form
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
        <ActionsPanel {...mockProps} />
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
        <ActionsPanel {...mockProps} />
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
        <ActionsPanel {...mockProps} />
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
        MOCK_SESSION_ID,
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
  it('should show empty state when there are no session actions', () => {
    const mockedHook = vi.mocked(useUserActionsList)
    mockedHook.mockImplementation(() => ({
      actions: [],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    }))

    render(
      <Wrapper>
        <ActionsPanel {...mockProps} />
      </Wrapper>
    )

    expect(screen.getByText('No actions yet for this session.')).toBeInTheDocument()

    // Restore original mock for subsequent tests
    mockedHook.mockImplementation(
      (userId, params) => {
        if (params?.coaching_session_id) {
          return {
            actions: mockSessionActions,
            isLoading: false,
            isError: false,
            refresh: mockRefreshSession,
          }
        }
        return {
          actions: mockAllRelationshipActions,
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
    // Override allActions to return only current-session actions so filterReviewActions
    // excludes them all, producing the empty "All caught up" state.
    const mockedHook = vi.mocked(useUserActionsList)
    mockedHook.mockImplementation((_userId, params) => {
      if (params?.coaching_session_id) {
        return {
          actions: mockSessionActions,
          isLoading: false,
          isError: false,
          refresh: mockRefreshSession,
        }
      }
      return {
        actions: mockSessionActions, // only current-session actions → all filtered out
        isLoading: false,
        isError: false,
        refresh: mockRefreshAll,
      }
    })

    render(
      <Wrapper>
        <ActionsPanel {...mockProps} />
      </Wrapper>
    )

    // Open the review section
    fireEvent.click(screen.getByText('Actions for Review'))

    expect(screen.getByText('All caught up')).toBeInTheDocument()

    // Restore default mock for subsequent tests
    mockedHook.mockImplementation((_userId, params) => {
      if (params?.coaching_session_id) {
        return {
          actions: mockSessionActions,
          isLoading: false,
          isError: false,
          refresh: mockRefreshSession,
        }
      }
      return {
        actions: mockAllRelationshipActions,
        isLoading: false,
        isError: false,
        refresh: mockRefreshAll,
      }
    })
  })

  /**
   * Asserts that completed actions have reduced opacity
   */
  it('should show completed actions with reduced opacity', () => {
    render(
      <Wrapper>
        <ActionsPanel {...mockProps} />
      </Wrapper>
    )

    const completedCard = screen.getByText('Review quarterly goals').closest('[class*="card"]')!
    expect(completedCard.className).toContain('opacity-60')
  })

  /**
   * Asserts that a network error during inline edit shows a network-specific toast
   */
  it('should show network error toast when editing an action fails due to connection loss', async () => {
    const axiosLikeError = Object.assign(new Error('Network Error'), { isAxiosError: true })
    const networkError = new EntityApiError('PUT', '/api/actions/action-1', axiosLikeError)
    mockProps.onActionEdited.mockRejectedValueOnce(networkError)

    const user = userEvent.setup()

    render(
      <Wrapper>
        <ActionsPanel {...mockProps} />
      </Wrapper>
    )

    // Trigger an inline body edit to exercise the updateField error path
    const bodyText = screen.getByText('Complete project proposal')
    await user.click(bodyText)

    const textarea = screen.getByDisplayValue('Complete project proposal')
    await user.clear(textarea)
    await user.type(textarea, 'Trigger network error')
    fireEvent.blur(textarea)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to update action. Connection to service was lost.'
      )
    })
  })

  /**
   * Asserts that a non-network error during inline edit shows a generic toast
   */
  it('should show generic error toast when editing an action fails', async () => {
    mockProps.onActionEdited.mockRejectedValueOnce(new Error('Internal server error'))

    const user = userEvent.setup()

    render(
      <Wrapper>
        <ActionsPanel {...mockProps} />
      </Wrapper>
    )

    // Trigger an inline body edit to exercise the updateField error path
    const bodyText = screen.getByText('Complete project proposal')
    await user.click(bodyText)

    const textarea = screen.getByDisplayValue('Complete project proposal')
    await user.clear(textarea)
    await user.type(textarea, 'Trigger generic error')
    fireEvent.blur(textarea)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update action.')
    })
  })

})
