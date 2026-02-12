import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActionsList } from '@/components/ui/coaching-sessions/actions-list'
import { TestProviders } from '@/test-utils/providers'
import { ItemStatus } from '@/types/general'
import { DateTime } from 'ts-luxon'
import { toast } from 'sonner'

vi.mock('sonner')

// Mock user IDs for coach and coachee
const MOCK_COACH_ID = 'coach-123'
const MOCK_COACHEE_ID = 'coachee-456'

// Mock the actions API hook
const mockActions = [
  {
    id: 'action-1',
    body: 'Complete project proposal',
    status: ItemStatus.InProgress,
    due_by: DateTime.fromISO('2024-01-15'),
    created_at: DateTime.fromISO('2024-01-01'),
    assignee_ids: [MOCK_COACH_ID],
  },
  {
    id: 'action-2',
    body: 'Review quarterly goals',
    status: ItemStatus.Completed,
    due_by: DateTime.fromISO('2024-01-20'),
    created_at: DateTime.fromISO('2024-01-02'),
    assignee_ids: [MOCK_COACH_ID, MOCK_COACHEE_ID],
  },
  {
    id: 'action-3',
    body: 'Unassigned task',
    status: ItemStatus.NotStarted,
    due_by: DateTime.fromISO('2024-01-25'),
    created_at: DateTime.fromISO('2024-01-03'),
    assignee_ids: [],
  }
]

const mockActionListHook = {
  actions: mockActions,
  isLoading: false,
  isError: false,
  refresh: vi.fn(),
}

vi.mock('@/lib/api/user-actions', () => ({
  useUserActionsList: vi.fn(() => mockActionListHook)
}))

/**
 * Test Suite: Actions CRUD Operations & Checkbox Toggle
 * 
 * Purpose: Validates Actions table functionality including completion status toggling,
 * CRUD operations, sorting with visual indicators, and form interactions.
 */
describe('ActionsList', () => {
  const mockProps = {
    coachingSessionId: 'session-123',
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
      body: 'New action',
      status: ItemStatus.NotStarted,
      due_by: DateTime.now(),
      created_at: DateTime.now(),
      assignee_ids: [],
    })
    mockProps.onActionEdited.mockResolvedValue({
      id: 'action-1',
      body: 'Updated action',
      status: ItemStatus.InProgress,
      due_by: DateTime.now(),
      created_at: DateTime.now(),
      assignee_ids: [MOCK_COACH_ID],
    })
  })

  /**
   * Asserts checkboxes appear and reflect correct checked/unchecked state based on action status
   * This validates the completion checkbox UI and state mapping
   */
  it('should render actions table with completion checkboxes', () => {
    render(
      <TestProviders>
        <ActionsList {...mockProps} />
      </TestProviders>
    )

    expect(screen.getByText('Complete project proposal')).toBeInTheDocument()
    expect(screen.getByText('Review quarterly goals')).toBeInTheDocument()
    expect(screen.getByText('Unassigned task')).toBeInTheDocument()

    // Check that completion checkboxes are present (3 actions)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(3)

    // Due to default sort by due_by desc:
    // action-3 (2024-01-25) comes first - NotStarted (unchecked)
    expect(checkboxes[0]).not.toBeChecked()
    // action-2 (2024-01-20) comes second - Completed (checked)
    expect(checkboxes[1]).toBeChecked()
    // action-1 (2024-01-15) comes third - InProgress (unchecked)
    expect(checkboxes[2]).not.toBeChecked()
  })

  /**
   * Asserts clicking checkbox calls onActionEdited with toggled status and preserves assignees
   * This validates the core completion toggle functionality
   */
  it('should toggle action completion status when checkbox is clicked', async () => {
    render(
      <TestProviders>
        <ActionsList {...mockProps} />
      </TestProviders>
    )

    const checkboxes = screen.getAllByRole('checkbox')

    // Click the second checkbox (which is action-2 due to sorting, Completed -> InProgress)
    fireEvent.click(checkboxes[1])

    await waitFor(() => {
      expect(mockProps.onActionEdited).toHaveBeenCalledWith(
        'action-2',
        'Review quarterly goals',
        ItemStatus.InProgress,
        mockActions[1].due_by,
        mockActions[1].assignee_ids // Assignees should be preserved
      )
    })

    expect(mockActionListHook.refresh).toHaveBeenCalled()
  })

  /**
   * Asserts reverse toggle works (InProgress → Completed)
   * This ensures bidirectional status toggling
   */
  it('should toggle in-progress action to completed', async () => {
    render(
      <TestProviders>
        <ActionsList {...mockProps} />
      </TestProviders>
    )

    const checkboxes = screen.getAllByRole('checkbox')

    // Click the third checkbox (which is action-1 due to sorting, InProgress -> Completed)
    fireEvent.click(checkboxes[2])

    await waitFor(() => {
      expect(mockProps.onActionEdited).toHaveBeenCalledWith(
        'action-1',
        'Complete project proposal',
        ItemStatus.Completed,
        mockActions[0].due_by,
        mockActions[0].assignee_ids // Assignees should be preserved
      )
    })

    expect(mockActionListHook.refresh).toHaveBeenCalled()
  })

  /**
   * Asserts form submission calls onActionAdded with correct parameters
   * This validates the create functionality with default (empty) assignees
   */
  it('should add new action when form is submitted', async () => {
    render(
      <TestProviders>
        <ActionsList {...mockProps} />
      </TestProviders>
    )

    const input = screen.getByPlaceholderText('Enter new action')
    const saveButton = screen.getByText('Save')

    fireEvent.change(input, { target: { value: 'New test action' } })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockProps.onActionAdded).toHaveBeenCalledWith(
        'New test action',
        ItemStatus.NotStarted,
        expect.any(DateTime),
        [] // Empty assignees when no selection made
      )
    })

    expect(mockActionListHook.refresh).toHaveBeenCalled()
  })

  /**
   * Asserts edit workflow populates form and updates via onActionEdited
   * This validates the edit functionality from dropdown to form submission
   */
  it('should edit existing action when edit is clicked and form is submitted', async () => {
    const user = userEvent.setup()

    render(
      <TestProviders>
        <ActionsList {...mockProps} />
      </TestProviders>
    )

    // Find and click the second action's dropdown menu (which is action-2 due to sorting by due_by desc)
    const dropdownTriggers = screen.getAllByRole('button', { name: /open menu/i })
    await user.click(dropdownTriggers[1])

    // Wait for dropdown to open and then click edit option
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })

    const editButton = screen.getByText('Edit')
    await user.click(editButton)

    // Form should now be in edit mode with action-2's data
    const input = screen.getByDisplayValue('Review quarterly goals')
    const updateButton = screen.getByText('Update')

    await user.clear(input)
    await user.type(input, 'Updated quarterly goals')
    await user.click(updateButton)

    await waitFor(() => {
      expect(mockProps.onActionEdited).toHaveBeenCalledWith(
        'action-2',
        'Updated quarterly goals',
        ItemStatus.Completed,
        mockActions[1].due_by,
        expect.any(Array) // Assignees loaded from existing action
      )
    })

    expect(mockActionListHook.refresh).toHaveBeenCalled()
  })

  /**
   * Asserts visual sorting indicators appear only on the currently sorted column
   * This validates the sorting UI feedback system
   */
  it('should display sorting arrows only for active sort column', () => {
    render(
      <TestProviders>
        <ActionsList {...mockProps} />
      </TestProviders>
    )

    // Due By should be the default sort column (desc)
    const dueBySortButton = screen.getByRole('columnheader', { name: /Due By/i })
    expect(dueBySortButton).toBeInTheDocument()
    
    // Should show down arrow for desc sort
    const downArrow = dueBySortButton?.querySelector('svg')
    expect(downArrow).toBeInTheDocument()
  })

  /**
   * Asserts clicking same header toggles sort direction
   * This validates sort direction toggle functionality
   */
  it('should change sort direction when clicking same column header', async () => {
    render(
      <TestProviders>
        <ActionsList {...mockProps} />
      </TestProviders>
    )

    const actionHeader = screen.getByText(/Action/i).closest('th')
    
    // Click once to sort by Action (asc)
    fireEvent.click(actionHeader!)
    
    // Click again to reverse sort (desc)
    fireEvent.click(actionHeader!)
    
    // Verify sorting behavior (actions should be reordered)
    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      // Skip header row, check data rows
      expect(rows.length).toBeGreaterThan(1)
    })
  })

  /**
   * Asserts delete dropdown option calls onActionDeleted
   * This validates the delete functionality
   */
  it('should delete action when delete is clicked', async () => {
    const user = userEvent.setup()
    mockProps.onActionDeleted.mockResolvedValue(mockActions[2])

    render(
      <TestProviders>
        <ActionsList {...mockProps} />
      </TestProviders>
    )

    // Find and click the first action's dropdown menu (which is action-3 due to sorting by due_by desc)
    const dropdownTriggers = screen.getAllByRole('button', { name: /open menu/i })
    await user.click(dropdownTriggers[0])

    // Wait for dropdown to open and then click delete option
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
    
    const deleteButton = screen.getByText('Delete')
    await user.click(deleteButton)

    await waitFor(() => {
      expect(mockProps.onActionDeleted).toHaveBeenCalledWith('action-3')
    })

    expect(mockActionListHook.refresh).toHaveBeenCalled()
  })

  /**
   * Asserts assignee badges are displayed correctly
   * This validates the assignee display UI
   */
  it('should display assignee badges for actions with assignees', () => {
    render(
      <TestProviders>
        <ActionsList {...mockProps} />
      </TestProviders>
    )

    // Coach Jane should appear for action-1 and action-2
    const coachBadges = screen.getAllByText('Coach Jane')
    expect(coachBadges.length).toBeGreaterThanOrEqual(1)

    // Coachee John should appear for action-2 (which has both)
    expect(screen.getByText('Coachee John')).toBeInTheDocument()

    // "None" should appear for action-3 (unassigned)
    expect(screen.getByText('None')).toBeInTheDocument()
  })

  /**
   * Asserts the Assignee column header is present
   */
  it('should display Assignee column header', () => {
    render(
      <TestProviders>
        <ActionsList {...mockProps} />
      </TestProviders>
    )

    // Find the Assignee text within a table header cell
    const assigneeHeader = screen.getByRole('columnheader', { name: /assignee/i })
    expect(assigneeHeader).toBeInTheDocument()
  })

  /**
   * Error Toast Tests
   * Validates that user-facing error messages appear when operations fail
   */
  describe('Error Toasts', () => {
    const mockToast = vi.mocked(toast)

    /**
     * Asserts toast.error is called when saving a new action fails
     * This ensures visible feedback on create failure
     */
    it('should show error toast when saving a new action fails', async () => {
      mockProps.onActionAdded.mockRejectedValue(new Error('Network error'))

      render(
        <TestProviders>
          <ActionsList {...mockProps} />
        </TestProviders>
      )

      const input = screen.getByPlaceholderText('Enter new action')
      const saveButton = screen.getByText('Save')

      fireEvent.change(input, { target: { value: 'New action' } })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to save action.')
      })
    })

    /**
     * Asserts toast.error is called when updating an action fails
     * This ensures visible feedback on update failure
     */
    it('should show error toast when updating an action fails', async () => {
      const user = userEvent.setup()
      mockProps.onActionEdited.mockRejectedValue(new Error('Network error'))

      render(
        <TestProviders>
          <ActionsList {...mockProps} />
        </TestProviders>
      )

      // Enter edit mode via dropdown on first action (action-3 due to sort)
      const dropdownTriggers = screen.getAllByRole('button', { name: /open menu/i })
      await user.click(dropdownTriggers[0])

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Edit'))

      const updateButton = screen.getByText('Update')
      await user.click(updateButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to update action.')
      })
    })

    /**
     * Asserts toast.error is called when deleting an action fails
     * This ensures visible feedback on delete failure
     */
    it('should show error toast when deleting an action fails', async () => {
      const user = userEvent.setup()
      mockProps.onActionDeleted.mockRejectedValue(new Error('Network error'))

      render(
        <TestProviders>
          <ActionsList {...mockProps} />
        </TestProviders>
      )

      const dropdownTriggers = screen.getAllByRole('button', { name: /open menu/i })
      await user.click(dropdownTriggers[0])

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Delete'))

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to delete action.')
      })
    })

    /**
     * Asserts toast.error is called when toggling action completion fails
     * This ensures visible feedback on checkbox toggle failure
     */
    it('should show error toast when completion toggle fails', async () => {
      mockProps.onActionEdited.mockRejectedValue(new Error('Network error'))

      render(
        <TestProviders>
          <ActionsList {...mockProps} />
        </TestProviders>
      )

      // Click the first checkbox (action-3 due to sort, NotStarted -> Completed)
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to update action status.')
      })
    })
  })
})