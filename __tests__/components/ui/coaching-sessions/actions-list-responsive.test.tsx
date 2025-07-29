import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
  }
]

vi.mock('@/lib/api/actions', () => ({
  useActionList: vi.fn(() => ({
    actions: mockActions,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  }))
}))

// Helper function to set viewport size
const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  })
  window.dispatchEvent(new Event('resize'))
}

/**
 * Test Suite: Actions Component Responsive Design
 * 
 * Purpose: Validates that the ActionsList component adapts correctly across different
 * screen sizes, hiding/showing columns appropriately and adjusting form layouts.
 */
describe('ActionsList Responsive Design', () => {
  const mockProps = {
    coachingSessionId: 'session-123',
    userId: 'user-123',
    locale: 'us',
    onActionAdded: vi.fn(),
    onActionEdited: vi.fn(),
    onActionDeleted: vi.fn(),
  }

  beforeEach(() => {
    setViewport(1024, 768) // Reset to desktop
  })

  afterEach(() => {
    setViewport(1024, 768) // Clean up
  })

  /**
   * Desktop Layout Tests (1024px+)
   * Validates full desktop experience with all columns visible
   */
  describe('Desktop Layout (1024px+)', () => {
    /**
     * Asserts all 5 columns (Completed, Action, Status, Due By, Assigned) are visible
     * This ensures full information is available on desktop
     */
    it('should show all table columns', () => {
      setViewport(1024, 768)
      
      render(
        <TestProviders>
          <ActionsList {...mockProps} />
        </TestProviders>
      )

      expect(screen.getByText('Completed?')).toBeInTheDocument()
      expect(screen.getByText(/Action/i)).toBeInTheDocument()
      expect(screen.getByText(/Status/i)).toBeInTheDocument()
      expect(screen.getByText(/Due By/i)).toBeInTheDocument()
      expect(screen.getByText(/Assigned/i)).toBeInTheDocument()
    })

    /**
     * Asserts form uses sm:flex-row layout
     * This validates horizontal form arrangement on desktop
     */
    it('should display form elements horizontally', () => {
      setViewport(1024, 768)
      
      render(
        <TestProviders>
          <ActionsList {...mockProps} />
        </TestProviders>
      )

      const formContainer = screen.getByRole('textbox').closest('div')
      expect(formContainer).toHaveClass('sm:flex-row')
    })
  })

  /**
   * Tablet Layout Tests (640px - 767px)
   * Validates intermediate screen size behavior
   */
  describe('Tablet Layout (640px - 767px)', () => {
    /**
     * Asserts Status column has hidden sm:table-cell classes
     * This ensures less critical info is hidden on smaller screens
     */
    it('should hide Status column on small tablets', () => {
      setViewport(640, 480)
      
      render(
        <TestProviders>
          <ActionsList {...mockProps} />
        </TestProviders>
      )

      const statusHeader = screen.getByText(/Status/i).closest('th')
      expect(statusHeader).toHaveClass('hidden', 'sm:table-cell')
    })

    /**
     * Asserts form stays horizontal on tablets
     * This validates form layout remains usable on medium screens
     */
    it('should maintain horizontal form layout', () => {
      setViewport(640, 480)
      
      render(
        <TestProviders>
          <ActionsList {...mockProps} />
        </TestProviders>
      )

      const formContainer = screen.getByRole('textbox').closest('div')
      expect(formContainer).toHaveClass('sm:flex-row', 'sm:items-center')
    })
  })

  /**
   * Mobile Layout Tests (< 640px)
   * Validates mobile-first responsive behavior
   */
  describe('Mobile Layout (< 640px)', () => {
    /**
     * Asserts these columns have hidden md:table-cell classes
     * This ensures mobile users see only essential information
     */
    it('should hide Due By and Assigned columns', () => {
      setViewport(375, 667)
      
      render(
        <TestProviders>
          <ActionsList {...mockProps} />
        </TestProviders>
      )

      const dueBySorter = screen.getByText(/Due By/i).closest('th')
      const assignedSorter = screen.getByText(/Assigned/i).closest('th')
      
      expect(dueBySorter).toHaveClass('hidden', 'md:table-cell')
      expect(assignedSorter).toHaveClass('hidden', 'md:table-cell')
    })

    /**
     * Asserts form uses flex-col space-y-2 on mobile
     * This ensures usable form layout on small screens
     */
    it('should stack form elements vertically', () => {
      setViewport(375, 667)
      
      render(
        <TestProviders>
          <ActionsList {...mockProps} />
        </TestProviders>
      )

      const formContainer = screen.getByRole('textbox').closest('div')
      expect(formContainer).toHaveClass('flex-col', 'space-y-2')
    })

    /**
     * Asserts input, select, and button all have w-full class
     * This maximizes usability on narrow screens
     */
    it('should make form inputs full width', () => {
      setViewport(375, 667)
      
      render(
        <TestProviders>
          <ActionsList {...mockProps} />
        </TestProviders>
      )

      const input = screen.getByPlaceholderText('Enter new action')
      const selectTrigger = screen.getByRole('combobox')
      const saveButton = screen.getByText('Save')

      expect(input).toHaveClass('w-full')
      expect(selectTrigger).toHaveClass('w-full')
      expect(saveButton).toHaveClass('w-full')
    })
  })

  /**
   * Table Header Styling Tests
   * Validates consistent visual design elements
   */
  describe('Table Header Styling', () => {
    /**
     * Asserts first header has rounded-tl-lg
     * This validates proper table corner styling
     */
    it('should have rounded top-left corner on first header', () => {
      render(
        <TestProviders>
          <ActionsList {...mockProps} />
        </TestProviders>
      )

      const firstHeader = screen.getByText('Completed?').closest('th')
      expect(firstHeader).toHaveClass('rounded-tl-lg')
    })

    /**
     * Asserts last header has rounded-tr-lg
     * This completes the table header corner styling
     */
    it('should have rounded top-right corner on last header', () => {
      render(
        <TestProviders>
          <ActionsList {...mockProps} />
        </TestProviders>
      )

      const lastHeader = screen.getByRole('columnheader', { name: '' })
      expect(lastHeader).toHaveClass('rounded-tr-lg')
    })

    /**
     * Asserts headers have proper font/color/padding classes
     * This validates consistent header appearance
     */
    it('should have consistent header styling', () => {
      render(
        <TestProviders>
          <ActionsList {...mockProps} />
        </TestProviders>
      )

      const header = screen.getByText('Completed?').closest('th')
      expect(header).toHaveClass('font-semibold', 'text-gray-700', 'dark:text-gray-300', 'py-3', 'px-4')
    })
  })
})