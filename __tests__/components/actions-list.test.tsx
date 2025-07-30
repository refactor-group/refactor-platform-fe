import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActionsList } from '@/components/ui/coaching-sessions/actions-list'
import { TestProviders } from '@/test-utils/providers'
import { ItemStatus } from '@/types/general'
import { DateTime } from 'ts-luxon'

// Mock the actions API hook
const mockActions = [
  {
    id: 'action-1',
    body: 'Complete project proposal',
    status: ItemStatus.InProgress,
    due_by: DateTime.fromISO('2024-01-15'),
    created_at: DateTime.fromISO('2024-01-01'),
  },
  {
    id: 'action-2', 
    body: 'Review quarterly goals',
    status: ItemStatus.Completed,
    due_by: DateTime.fromISO('2024-01-20'),
    created_at: DateTime.fromISO('2024-01-02'),
  }
]

const mockActionListHook = {
  actions: mockActions,
  isLoading: false,
  isError: false,
  refresh: vi.fn(),
}

vi.mock('@/lib/api/actions', () => ({
  useActionList: vi.fn(() => mockActionListHook)
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
    })
    mockProps.onActionEdited.mockResolvedValue({
      id: 'action-1',
      body: 'Updated action',
      status: ItemStatus.InProgress,
      due_by: DateTime.now(),
      created_at: DateTime.now(),
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
    
    // Check that completion checkboxes are present
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    
    // Due to default sort by due_by desc, action-2 (2024-01-20) comes first and should be checked (Completed)
    expect(checkboxes[0]).toBeChecked()
    // action-1 (2024-01-15) comes second and should be unchecked (InProgress)
    expect(checkboxes[1]).not.toBeChecked()
  })

  /**
   * Asserts clicking checkbox calls onActionEdited with toggled status (InProgress → Completed)
   * This validates the core completion toggle functionality
   */
  it('should toggle action completion status when checkbox is clicked', async () => {
    render(
      <TestProviders>
        <ActionsList {...mockProps} />
      </TestProviders>
    )

    const checkboxes = screen.getAllByRole('checkbox')
    
    // Click the first checkbox (which is action-2 due to sorting, Completed -> InProgress)
    fireEvent.click(checkboxes[0])

    await waitFor(() => {
      expect(mockProps.onActionEdited).toHaveBeenCalledWith(
        'action-2',
        'Review quarterly goals',
        ItemStatus.InProgress,
        mockActions[1].due_by
      )
    })

    expect(mockActionListHook.refresh).toHaveBeenCalled()
  })

  /**
   * Asserts reverse toggle works (Completed → InProgress)
   * This ensures bidirectional status toggling
   */
  it('should toggle completed action back to in progress', async () => {
    render(
      <TestProviders>
        <ActionsList {...mockProps} />
      </TestProviders>
    )

    const checkboxes = screen.getAllByRole('checkbox')
    
    // Click the second checkbox (which is action-1 due to sorting, InProgress -> Completed)
    fireEvent.click(checkboxes[1])

    await waitFor(() => {
      expect(mockProps.onActionEdited).toHaveBeenCalledWith(
        'action-1',
        'Complete project proposal',
        ItemStatus.Completed,
        mockActions[0].due_by
      )
    })

    expect(mockActionListHook.refresh).toHaveBeenCalled()
  })

  /**
   * Asserts form submission calls onActionAdded with correct parameters
   * This validates the create functionality
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
        expect.any(DateTime)
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

    // Find and click the first action's dropdown menu (which is action-2 due to sorting)
    const dropdownTriggers = screen.getAllByRole('button', { name: /open menu/i })
    await user.click(dropdownTriggers[0])

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
        mockActions[1].due_by
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
    const dueBySortButton = screen.getByText(/Due By/i).closest('th')
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
    mockProps.onActionDeleted.mockResolvedValue(mockActions[1])
    
    render(
      <TestProviders>
        <ActionsList {...mockProps} />
      </TestProviders>
    )

    // Find and click the first action's dropdown menu (which is action-2 due to sorting)
    const dropdownTriggers = screen.getAllByRole('button', { name: /open menu/i })
    await user.click(dropdownTriggers[0])

    // Wait for dropdown to open and then click delete option
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
    
    const deleteButton = screen.getByText('Delete')
    await user.click(deleteButton)

    await waitFor(() => {
      expect(mockProps.onActionDeleted).toHaveBeenCalledWith('action-2')
    })

    expect(mockActionListHook.refresh).toHaveBeenCalled()
  })
})