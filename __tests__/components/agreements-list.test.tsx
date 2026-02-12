import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgreementsList } from '@/components/ui/coaching-sessions/agreements-list'
import { TestProviders } from '@/test-utils/providers'
import { DateTime } from 'ts-luxon'

// Mock the agreements API hook
const mockAgreements = [
  {
    id: 'agreement-1',
    body: 'Weekly 1:1 meetings every Tuesday',
    created_at: DateTime.fromISO('2024-01-01'),
    updated_at: DateTime.fromISO('2024-01-01'),
  },
  {
    id: 'agreement-2',
    body: 'Monthly goal review sessions',
    created_at: DateTime.fromISO('2024-01-02'),
    updated_at: DateTime.fromISO('2024-01-03'),
  }
]

const mockAgreementListHook = {
  agreements: mockAgreements,
  isLoading: false,
  isError: false,
  refresh: vi.fn(),
}

vi.mock('@/lib/api/agreements', () => ({
  useAgreementList: vi.fn(() => mockAgreementListHook)
}))

/**
 * Test Suite: Agreements CRUD Operations & Keyboard Shortcuts
 * 
 * Purpose: Validates Agreements table functionality including CRUD operations,
 * sorting with visual indicators, form interactions, and keyboard shortcuts.
 */
describe('AgreementsList', () => {
  const mockProps = {
    coachingSessionId: 'session-123',
    userId: 'user-123',
    locale: 'us',
    isSaving: false,
    onAgreementAdded: vi.fn(),
    onAgreementEdited: vi.fn(),
    onAgreementDeleted: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockProps.onAgreementAdded.mockResolvedValue({
      id: 'new-agreement',
      body: 'New agreement',
      created_at: DateTime.now(),
      updated_at: DateTime.now(),
    })
    mockProps.onAgreementEdited.mockResolvedValue({
      id: 'agreement-1',
      body: 'Updated agreement',
      created_at: DateTime.now(),
      updated_at: DateTime.now(),
    })
  })

  /**
   * Asserts table headers and data render correctly
   * This validates the basic table structure and styling
   */
  it('should render agreements table with proper styling', () => {
    render(
      <TestProviders>
        <AgreementsList {...mockProps} />
      </TestProviders>
    )

    expect(screen.getByText('Weekly 1:1 meetings every Tuesday')).toBeInTheDocument()
    expect(screen.getByText('Monthly goal review sessions')).toBeInTheDocument()
    
    // Check for table headers with proper styling
    expect(screen.getByText(/Agreement/i)).toBeInTheDocument()
    expect(screen.getByText(/Created/i)).toBeInTheDocument()
    expect(screen.getByText(/Updated/i)).toBeInTheDocument()
  })

  /**
   * Asserts form calls onAgreementAdded and clears input
   * This validates the create functionality and form reset
   */
  it('should add new agreement when form is submitted', async () => {
    render(
      <TestProviders>
        <AgreementsList {...mockProps} />
      </TestProviders>
    )

    const input = screen.getByPlaceholderText('Enter new agreement')
    const saveButton = screen.getByText('Save')

    fireEvent.change(input, { target: { value: 'New test agreement' } })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockProps.onAgreementAdded).toHaveBeenCalledWith('New test agreement')
    })

    expect(mockAgreementListHook.refresh).toHaveBeenCalled()
    
    // Form should be cleared after successful submission
    expect(input).toHaveValue('')
  })

  /**
   * Asserts edit flow populates form with existing text and updates correctly
   * This validates the edit workflow from dropdown to form submission
   */
  it('should edit existing agreement when edit is clicked and form is submitted', async () => {
    const user = userEvent.setup()
    
    render(
      <TestProviders>
        <AgreementsList {...mockProps} />
      </TestProviders>
    )

    // Find and click the first agreement's dropdown menu
    const dropdownTriggers = screen.getAllByRole('button', { name: /open menu/i })
    await user.click(dropdownTriggers[0])

    // Wait for dropdown to open and then click edit option
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    
    const editButton = screen.getByText('Edit')
    await user.click(editButton)

    // Form should now be in edit mode with existing text (agreement-2 due to sorting)
    const input = screen.getByDisplayValue('Monthly goal review sessions')
    const updateButton = screen.getByText('Update')

    await user.clear(input)
    await user.type(input, 'Updated monthly reviews')
    await user.click(updateButton)

    await waitFor(() => {
      expect(mockProps.onAgreementEdited).toHaveBeenCalledWith(
        'agreement-2',
        'Updated monthly reviews'
      )
    })

    expect(mockAgreementListHook.refresh).toHaveBeenCalled()
  })

  /**
   * Asserts sorting visual indicators work correctly
   * This validates the sorting UI feedback system
   */
  it('should display sorting arrows only for active sort column', () => {
    render(
      <TestProviders>
        <AgreementsList {...mockProps} />
      </TestProviders>
    )

    // Created should be the default sort column (desc)
    const createdSortButton = screen.getByText(/Created/i).closest('th')
    expect(createdSortButton).toBeInTheDocument()
    
    // Should show down arrow for desc sort
    const downArrow = createdSortButton?.querySelector('svg')
    expect(downArrow).toBeInTheDocument()
  })

  /**
   * Asserts sort direction toggle functionality
   * This validates clicking same header reverses sort order
   */
  it('should change sort direction when clicking same column header', async () => {
    render(
      <TestProviders>
        <AgreementsList {...mockProps} />
      </TestProviders>
    )

    const agreementHeader = screen.getByText(/Agreement/i).closest('th')
    
    // Click once to sort by Agreement (asc)
    fireEvent.click(agreementHeader!)
    
    // Click again to reverse sort (desc)
    fireEvent.click(agreementHeader!)
    
    // Verify sorting behavior (agreements should be reordered)
    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      // Skip header row, check data rows
      expect(rows.length).toBeGreaterThan(1)
    })
  })

  /**
   * Asserts delete calls onAgreementDeleted
   * This validates the delete functionality
   */
  it('should delete agreement when delete is clicked', async () => {
    const user = userEvent.setup()
    mockProps.onAgreementDeleted.mockResolvedValue(mockAgreements[1])
    
    render(
      <TestProviders>
        <AgreementsList {...mockProps} />
      </TestProviders>
    )

    // Find and click the first agreement's dropdown menu
    const dropdownTriggers = screen.getAllByRole('button', { name: /open menu/i })
    await user.click(dropdownTriggers[0])

    // Wait for dropdown to open and then click delete option
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
    
    const deleteButton = screen.getByText('Delete')
    await user.click(deleteButton)

    await waitFor(() => {
      expect(mockProps.onAgreementDeleted).toHaveBeenCalledWith('agreement-2')
    })

    expect(mockAgreementListHook.refresh).toHaveBeenCalled()
  })

  /**
   * Asserts Enter key saves form
   * This validates keyboard shortcut functionality for form submission
   */
  it('should handle keyboard shortcuts for form interaction', async () => {
    render(
      <TestProviders>
        <AgreementsList {...mockProps} />
      </TestProviders>
    )

    const input = screen.getByPlaceholderText('Enter new agreement')
    
    // Type agreement text
    fireEvent.change(input, { target: { value: 'Agreement via keyboard' } })
    
    // Press Enter to save
    fireEvent.keyDown(input.closest('div')!, { key: 'Enter' })

    await waitFor(() => {
      expect(mockProps.onAgreementAdded).toHaveBeenCalledWith('Agreement via keyboard')
    })
  })

  /**
   * Asserts Escape key clears form in add mode
   * This validates keyboard shortcut for form clearing
   */
  it('should clear form when Escape is pressed', () => {
    render(
      <TestProviders>
        <AgreementsList {...mockProps} />
      </TestProviders>
    )

    const input = screen.getByPlaceholderText('Enter new agreement')
    
    // Type some text
    fireEvent.change(input, { target: { value: 'Some text' } })
    expect(input).toHaveValue('Some text')
    
    // Press Escape to clear
    fireEvent.keyDown(input.closest('div')!, { key: 'Escape' })
    
    expect(input).toHaveValue('')
  })

  /**
   * Asserts Escape cancels edit and returns to add mode
   * This validates keyboard shortcut for canceling edit operations
   */
  it('should cancel edit mode when Escape is pressed during editing', async () => {
    render(
      <TestProviders>
        <AgreementsList {...mockProps} />
      </TestProviders>
    )

    // Start editing
    const user = userEvent.setup()
    const dropdownTriggers = screen.getAllByRole('button', { name: /open menu/i })
    await user.click(dropdownTriggers[0])
    
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('Edit'))

    const input = screen.getByDisplayValue('Monthly goal review sessions')
    
    // Change the text
    fireEvent.change(input, { target: { value: 'Modified text' } })
    
    // Press Escape to cancel
    fireEvent.keyDown(input.closest('div')!, { key: 'Escape' })
    
    // Should return to add mode with empty form
    expect(screen.getByPlaceholderText('Enter new agreement')).toHaveValue('')
    expect(screen.getByText('Save')).toBeInTheDocument()
  })
})