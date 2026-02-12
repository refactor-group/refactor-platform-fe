import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
  }
]

vi.mock('@/lib/api/agreements', () => ({
  useAgreementList: vi.fn(() => ({
    agreements: mockAgreements,
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
 * Test Suite: Agreements Component Responsive Design
 * 
 * Purpose: Validates that the AgreementsList component adapts correctly across different
 * screen sizes, hiding/showing columns appropriately and adjusting form layouts.
 */
describe('AgreementsList Responsive Design', () => {
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
     * Asserts Agreement, Created, Updated columns are visible
     * This ensures full information is available on desktop
     */
    it('should show all table columns', () => {
      setViewport(1024, 768)
      
      render(
        <TestProviders>
          <AgreementsList {...mockProps} />
        </TestProviders>
      )

      expect(screen.getByText(/Agreement/i)).toBeInTheDocument()
      expect(screen.getByText(/Created/i)).toBeInTheDocument()
      expect(screen.getByText(/Updated/i)).toBeInTheDocument()
    })

    /**
     * Asserts horizontal form layout
     * This validates form arrangement on desktop
     */
    it('should display form elements horizontally', () => {
      setViewport(1024, 768)
      
      render(
        <TestProviders>
          <AgreementsList {...mockProps} />
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
     * Asserts Created column has responsive hiding classes
     * This ensures less critical timestamp info is hidden on smaller screens
     */
    it('should hide Created column on small tablets', () => {
      setViewport(640, 480)
      
      render(
        <TestProviders>
          <AgreementsList {...mockProps} />
        </TestProviders>
      )

      const createdHeader = screen.getByText(/Created/i).closest('th')
      expect(createdHeader).toHaveClass('hidden', 'sm:table-cell')
    })

    /**
     * Asserts form stays horizontal
     * This validates form layout remains usable on medium screens
     */
    it('should maintain horizontal form layout', () => {
      setViewport(640, 480)
      
      render(
        <TestProviders>
          <AgreementsList {...mockProps} />
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
     * Asserts Updated column hidden on small screens
     * This ensures mobile users see only essential agreement text
     */
    it('should hide Updated column on mobile', () => {
      setViewport(375, 667)
      
      render(
        <TestProviders>
          <AgreementsList {...mockProps} />
        </TestProviders>
      )

      const updatedHeader = screen.getByText(/Updated/i).closest('th')
      expect(updatedHeader).toHaveClass('hidden', 'md:table-cell')
    })

    /**
     * Asserts vertical form stacking
     * This ensures usable form layout on small screens
     */
    it('should stack form elements vertically', () => {
      setViewport(375, 667)
      
      render(
        <TestProviders>
          <AgreementsList {...mockProps} />
        </TestProviders>
      )

      const formContainer = screen.getByRole('textbox').closest('div')
      expect(formContainer).toHaveClass('flex-col', 'space-y-2')
    })

    /**
     * Asserts input and button are full width
     * This maximizes usability on narrow screens
     */
    it('should make form inputs full width', () => {
      setViewport(375, 667)
      
      render(
        <TestProviders>
          <AgreementsList {...mockProps} />
        </TestProviders>
      )

      const input = screen.getByPlaceholderText('Enter new agreement')
      const saveButton = screen.getByText('Save')

      expect(input).toHaveClass('w-full')
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
          <AgreementsList {...mockProps} />
        </TestProviders>
      )

      const firstHeader = screen.getByText(/Agreement/i).closest('th')
      expect(firstHeader).toHaveClass('rounded-tl-lg')
    })

    /**
     * Asserts last header has rounded-tr-lg
     * This completes the table header corner styling
     */
    it('should have rounded top-right corner on last header', () => {
      render(
        <TestProviders>
          <AgreementsList {...mockProps} />
        </TestProviders>
      )

      const lastHeader = screen.getByRole('columnheader', { name: '' })
      expect(lastHeader).toHaveClass('rounded-tr-lg')
    })

    /**
     * Asserts header has proper font/color/padding classes
     * This validates consistent header appearance
     */
    it('should have consistent header styling', () => {
      render(
        <TestProviders>
          <AgreementsList {...mockProps} />
        </TestProviders>
      )

      const header = screen.getByText(/Agreement/i).closest('th')
      expect(header).toHaveClass('font-semibold', 'text-gray-700', 'dark:text-gray-300', 'py-3', 'px-4')
    })
  })
})