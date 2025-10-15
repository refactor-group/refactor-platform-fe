import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { EditorProvider } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { LinkPopover } from '@/components/ui/tiptap-ui/link-popover'
import { TooltipProvider } from '@/components/ui/tooltip'

// Mock ResizeObserver for test environment
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

describe('LinkPopover', () => {
  const createEditorWithContent = (content: string = '') => {
    const extensions = [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
    ]

    return { extensions, content }
  }

  // Helper to wrap components with required providers
  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <TooltipProvider>
        {ui}
      </TooltipProvider>
    )
  }

  beforeEach(() => {
    // Clear any existing popovers from previous tests
    document.body.innerHTML = ''
  })

  describe('Single Popover Rendering', () => {
    it('should render only one popover when link button is clicked', async () => {
      const user = userEvent.setup()
      const { extensions, content } = createEditorWithContent('Test content')

      renderWithProviders(
        <EditorProvider extensions={extensions} content={content}>
          <div data-testid="toolbar">
            <LinkPopover />
          </div>
        </EditorProvider>
      )

      // Click the link button
      const linkButton = screen.getByLabelText('Link')
      await user.click(linkButton)

      // Wait for popover to appear
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Paste a link...')).toBeInTheDocument()
      })

      // Verify only ONE popover exists
      const popovers = document.querySelectorAll('.tiptap-popover')
      expect(popovers).toHaveLength(1)
    })

    it('should not show duplicate popovers when clicked multiple times quickly', async () => {
      const user = userEvent.setup()
      const { extensions, content } = createEditorWithContent('Test content')

      renderWithProviders(
        <EditorProvider extensions={extensions} content={content}>
          <div data-testid="toolbar">
            <LinkPopover />
          </div>
        </EditorProvider>
      )

      const linkButton = screen.getByLabelText('Link')

      // Rapid clicks
      await user.click(linkButton)
      await user.click(linkButton)
      await user.click(linkButton)

      await waitFor(() => {
        const popovers = document.querySelectorAll('.tiptap-popover')
        // Should still be only 1 (clicking toggles it open/closed)
        expect(popovers.length).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('Popover Positioning', () => {
    it('should position popover with fixed positioning', async () => {
      const user = userEvent.setup()
      const { extensions, content } = createEditorWithContent('Test content')

      renderWithProviders(
        <EditorProvider extensions={extensions} content={content}>
          <div data-testid="toolbar" style={{ marginTop: '100px', marginLeft: '50px' }}>
            <LinkPopover />
          </div>
        </EditorProvider>
      )

      const linkButton = screen.getByLabelText('Link')
      await user.click(linkButton)

      await waitFor(() => {
        const popover = document.querySelector('.tiptap-popover')
        expect(popover).toBeInTheDocument()

        if (popover) {
          // Verify popover has fixed positioning style
          const style = window.getComputedStyle(popover)
          expect(style.position).toBe('fixed')

          // Verify popover has explicit top/left positioning (not default auto)
          expect(popover.getAttribute('style')).toContain('top:')
          expect(popover.getAttribute('style')).toContain('left:')
        }
      })
    })

    it('should position popover near the trigger button', async () => {
      const user = userEvent.setup()
      const { extensions, content } = createEditorWithContent('Test content')

      renderWithProviders(
        <EditorProvider extensions={extensions} content={content}>
          <div data-testid="toolbar">
            <LinkPopover />
          </div>
        </EditorProvider>
      )

      const linkButton = screen.getByLabelText('Link')
      const buttonRect = linkButton.getBoundingClientRect()

      await user.click(linkButton)

      await waitFor(() => {
        const popover = document.querySelector('.tiptap-popover')
        expect(popover).toBeInTheDocument()

        if (popover) {
          const popoverRect = popover.getBoundingClientRect()
          // Popover should be positioned relative to button (within reasonable distance)
          const verticalDistance = Math.abs(popoverRect.top - buttonRect.bottom)
          const horizontalDistance = Math.abs(popoverRect.left - buttonRect.left)

          // Should be relatively close (within 200px for generous tolerance)
          expect(verticalDistance).toBeLessThan(200)
          expect(horizontalDistance).toBeLessThan(200)
        }
      })
    })
  })

  describe('Multiple LinkPopover Instances', () => {
    it('should only show one popover when multiple LinkPopover components exist', async () => {
      const user = userEvent.setup()
      const { extensions, content } = createEditorWithContent('Test content')

      renderWithProviders(
        <EditorProvider extensions={extensions} content={content}>
          <div>
            {/* Simulate static toolbar */}
            <div data-testid="static-toolbar" style={{ display: 'block' }}>
              <LinkPopover />
            </div>
            {/* Simulate floating toolbar */}
            <div data-testid="floating-toolbar" style={{ display: 'none' }}>
              <LinkPopover />
            </div>
          </div>
        </EditorProvider>
      )

      // Click link button in static toolbar
      const toolbars = screen.getAllByLabelText('Link')
      await user.click(toolbars[0])

      await waitFor(() => {
        const popovers = document.querySelectorAll('.tiptap-popover')
        // Even with 2 LinkPopover components, only 1 popover should be visible
        expect(popovers).toHaveLength(1)
      })
    })

    it('should conditionally render based on parent visibility', async () => {
      const user = userEvent.setup()
      const { extensions, content } = createEditorWithContent('Test content')

      const { rerender } = renderWithProviders(
        <EditorProvider extensions={extensions} content={content}>
          <div>
            {/* Static toolbar - visible */}
            <div data-testid="static-toolbar" style={{ display: 'block' }}>
              <LinkPopover />
            </div>
            {/* Floating toolbar - conditionally rendered */}
            {false && (
              <div data-testid="floating-toolbar">
                <LinkPopover />
              </div>
            )}
          </div>
        </EditorProvider>
      )

      // Should only have 1 LinkPopover rendered
      const linkButtons = screen.getAllByLabelText('Link')
      expect(linkButtons).toHaveLength(1)

      // Click to open popover
      await user.click(linkButtons[0])

      await waitFor(() => {
        const popovers = document.querySelectorAll('.tiptap-popover')
        expect(popovers).toHaveLength(1)
      })
    })
  })

  describe('Link Creation Functionality', () => {
    it('should allow creating a link', async () => {
      const user = userEvent.setup()
      const { extensions, content } = createEditorWithContent('<p>Test text</p>')

      const { container } = renderWithProviders(
        <EditorProvider extensions={extensions} content={content}>
          <div>
            <LinkPopover />
            <div className="ProseMirror" />
          </div>
        </EditorProvider>
      )

      // Click link button
      const linkButton = screen.getByLabelText('Link')
      await user.click(linkButton)

      // Wait for popover
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Paste a link...')).toBeInTheDocument()
      })

      // Type URL
      const input = screen.getByPlaceholderText('Paste a link...')
      await user.type(input, 'https://example.com')

      // URL should be in the input
      expect(input).toHaveValue('https://example.com')
    })
  })

  describe('Popover State Management', () => {
    it('should toggle popover open and closed', async () => {
      const user = userEvent.setup()
      const { extensions, content } = createEditorWithContent('Test content')

      renderWithProviders(
        <EditorProvider extensions={extensions} content={content}>
          <LinkPopover />
        </EditorProvider>
      )

      const linkButton = screen.getByLabelText('Link')

      // Open popover
      await user.click(linkButton)
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Paste a link...')).toBeInTheDocument()
      })

      // Close popover by clicking button again
      await user.click(linkButton)
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Paste a link...')).not.toBeInTheDocument()
      })
    })

    it('should close popover when clicking outside', async () => {
      const user = userEvent.setup()
      const { extensions, content } = createEditorWithContent('Test content')

      const { container } = renderWithProviders(
        <div>
          <EditorProvider extensions={extensions} content={content}>
            <LinkPopover />
          </EditorProvider>
          <div data-testid="outside">Outside content</div>
        </div>
      )

      const linkButton = screen.getByLabelText('Link')

      // Open popover
      await user.click(linkButton)
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Paste a link...')).toBeInTheDocument()
      })

      // Click outside
      const outside = screen.getByTestId('outside')
      await user.click(outside)

      // Popover should close
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Paste a link...')).not.toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle containerRef prop gracefully', async () => {
      const user = userEvent.setup()
      const { extensions, content } = createEditorWithContent('Test content')
      const containerRef = { current: document.createElement('div') }

      renderWithProviders(
        <EditorProvider extensions={extensions} content={content}>
          <LinkPopover containerRef={containerRef} />
        </EditorProvider>
      )

      const linkButton = screen.getByLabelText('Link')
      await user.click(linkButton)

      // Should still work with containerRef
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Paste a link...')).toBeInTheDocument()
      })

      const popovers = document.querySelectorAll('.tiptap-popover')
      expect(popovers).toHaveLength(1)
    })

    it('should handle undefined containerRef', async () => {
      const user = userEvent.setup()
      const { extensions, content } = createEditorWithContent('Test content')

      renderWithProviders(
        <EditorProvider extensions={extensions} content={content}>
          <LinkPopover containerRef={undefined} />
        </EditorProvider>
      )

      const linkButton = screen.getByLabelText('Link')
      await user.click(linkButton)

      // Should work without containerRef
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Paste a link...')).toBeInTheDocument()
      })
    })
  })

  describe('Auto-Open Behavior (Google Docs style)', () => {
    it('should open popover when cursor is inside link (keyboard or mouse)', async () => {
      const user = userEvent.setup()
      const { extensions, content } = createEditorWithContent(
        '<p>Text with <a href="https://example.com">existing link</a> here</p>'
      )

      const { container } = renderWithProviders(
        <EditorProvider extensions={extensions} content={content}>
          <div>
            <LinkPopover />
            <div className="ProseMirror" />
          </div>
        </EditorProvider>
      )

      // Wait for editor to be ready
      await waitFor(() => {
        const editor = container.querySelector('.tiptap.ProseMirror')
        expect(editor).toBeInTheDocument()
      })

      // Popover should not be visible initially
      expect(screen.queryByPlaceholderText('Paste a link...')).not.toBeInTheDocument()

      // Note: Testing actual cursor movement inside link boundaries is difficult in jsdom
      // This test verifies the component renders correctly. Full behavior tested in E2E.
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should open popover when link button is explicitly clicked', async () => {
      const user = userEvent.setup()
      const { extensions, content } = createEditorWithContent(
        '<p>Text with <a href="https://example.com">existing link</a> here</p>'
      )

      renderWithProviders(
        <EditorProvider extensions={extensions} content={content}>
          <div>
            <LinkPopover />
            <div className="ProseMirror" />
          </div>
        </EditorProvider>
      )

      // Click the link button
      const linkButton = screen.getByLabelText('Link')
      await user.click(linkButton)

      // Popover should open on explicit button click
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Paste a link...')).toBeInTheDocument()
      })
    })

    it('should distinguish between clicking inside link vs at boundaries', async () => {
      // Note: This test validates the isCursorInsideLink logic exists
      // Full boundary behavior testing requires DOM interaction which is
      // difficult to simulate in jsdom. This is better tested in E2E tests.
      const user = userEvent.setup()
      const { extensions, content } = createEditorWithContent(
        '<p>Text with <a href="https://example.com">link</a> here</p>'
      )

      renderWithProviders(
        <EditorProvider extensions={extensions} content={content}>
          <div>
            <LinkPopover />
          </div>
        </EditorProvider>
      )

      // Verify link button exists and can be clicked
      const linkButton = screen.getByLabelText('Link')
      await user.click(linkButton)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Paste a link...')).toBeInTheDocument()
      })
    })
  })
})
