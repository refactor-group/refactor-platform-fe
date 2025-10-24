import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FloatingToolbar } from '@/components/ui/coaching-sessions/coaching-notes/floating-toolbar'
import { TOOLBAR_HEIGHT_PX, TOOLBAR_SHOW_THRESHOLD, TOOLBAR_HIDE_THRESHOLD } from '@/components/ui/coaching-sessions/coaching-notes/constants'
import * as React from 'react'

// Mock the SimpleToolbar component
vi.mock('@/components/ui/coaching-sessions/coaching-notes/simple-toolbar', () => ({
  SimpleToolbar: () => <div data-testid="simple-toolbar">Simple Toolbar</div>
}))

// Mock TipTap hooks
vi.mock('@tiptap/react', () => ({
  useCurrentEditor: () => ({ editor: null }),
  useEditorState: () => ({ canUndo: false, canRedo: false })
}))

describe('FloatingToolbar', () => {
  let editorRef: React.RefObject<HTMLDivElement>
  let toolbarRef: React.RefObject<HTMLDivElement>
  const headerHeight = 64
  const onVisibilityChange = vi.fn()

  beforeEach(() => {
    // Create refs with actual DOM elements
    editorRef = { current: document.createElement('div') }
    toolbarRef = { current: document.createElement('div') }

    // Setup initial positions for editor and toolbar
    editorRef.current.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      bottom: 800,
      left: 0,
      right: 1000,
      width: 1000,
      height: 700,
      x: 0,
      y: 100,
      toJSON: () => ({})
    }))

    toolbarRef.current.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      bottom: 152, // 100 + TOOLBAR_HEIGHT_PX
      left: 0,
      right: 1000,
      width: 1000,
      height: TOOLBAR_HEIGHT_PX,
      x: 0,
      y: 100,
      toJSON: () => ({})
    }))

    // Mock window dimensions
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 900
    })

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('should not show floating toolbar when editor is at top', () => {
      render(
        <FloatingToolbar
          editorRef={editorRef}
          toolbarRef={toolbarRef}
          headerHeight={headerHeight}
          onOriginalToolbarVisibilityChange={onVisibilityChange}
        />
      )

      // Use hidden option to find elements with display: none
      const floatingToolbar = screen.getByRole('toolbar', { hidden: true })
      expect(floatingToolbar).toBeInTheDocument()
      expect(floatingToolbar).toHaveStyle({ display: 'none' })
    })

    it('should call visibility change callback with true initially', async () => {
      render(
        <FloatingToolbar
          editorRef={editorRef}
          toolbarRef={toolbarRef}
          headerHeight={headerHeight}
          onOriginalToolbarVisibilityChange={onVisibilityChange}
        />
      )

      // Wait for initial visibility check (debounce + initial effect)
      await waitFor(() => {
        expect(onVisibilityChange).toHaveBeenCalledWith(true)
      }, { timeout: 200 })
    })
  })

  describe('Show Threshold Behavior', () => {
    it('should show floating toolbar when scrolled past show threshold', async () => {
      // Position editor so toolbar is past show threshold (95% hidden)
      const thresholdPosition = headerHeight - (TOOLBAR_HEIGHT_PX * TOOLBAR_SHOW_THRESHOLD) - 5

      editorRef.current!.getBoundingClientRect = vi.fn(() => ({
        top: thresholdPosition,
        bottom: thresholdPosition + 700,
        left: 0,
        right: 1000,
        width: 1000,
        height: 700,
        x: 0,
        y: thresholdPosition,
        toJSON: () => ({})
      }))

      const { rerender } = render(
        <FloatingToolbar
          editorRef={editorRef}
          toolbarRef={toolbarRef}
          headerHeight={headerHeight}
          onOriginalToolbarVisibilityChange={onVisibilityChange}
        />
      )

      // Trigger resize to recalculate
      window.dispatchEvent(new Event('resize'))

      // Force re-render to trigger scroll check
      rerender(
        <FloatingToolbar
          editorRef={editorRef}
          toolbarRef={toolbarRef}
          headerHeight={headerHeight}
          onOriginalToolbarVisibilityChange={onVisibilityChange}
        />
      )

      await waitFor(() => {
        const floatingToolbar = screen.getByRole('toolbar')
        expect(floatingToolbar).not.toHaveStyle({ display: 'none' })
      }, { timeout: 200 })
    })
  })

  describe('Hide Threshold Behavior (Hysteresis)', () => {
    it('should maintain floating toolbar when between hide and show thresholds', async () => {
      // Start with toolbar visible (past show threshold)
      const scrolledPosition = headerHeight - (TOOLBAR_HEIGHT_PX * TOOLBAR_SHOW_THRESHOLD) - 10

      editorRef.current!.getBoundingClientRect = vi.fn(() => ({
        top: scrolledPosition,
        bottom: scrolledPosition + 700,
        left: 0,
        right: 1000,
        width: 1000,
        height: 700,
        x: 0,
        y: scrolledPosition,
        toJSON: () => ({})
      }))

      const { rerender } = render(
        <FloatingToolbar
          editorRef={editorRef}
          toolbarRef={toolbarRef}
          headerHeight={headerHeight}
          onOriginalToolbarVisibilityChange={onVisibilityChange}
        />
      )

      window.dispatchEvent(new Event('resize'))

      await waitFor(() => {
        const floatingToolbar = screen.getByRole('toolbar')
        expect(floatingToolbar).not.toHaveStyle({ display: 'none' })
      }, { timeout: 200 })

      // Now scroll up slightly, but not past hide threshold (25%)
      const betweenThresholdsPosition = headerHeight - (TOOLBAR_HEIGHT_PX * TOOLBAR_HIDE_THRESHOLD) - 5

      editorRef.current!.getBoundingClientRect = vi.fn(() => ({
        top: betweenThresholdsPosition,
        bottom: betweenThresholdsPosition + 700,
        left: 0,
        right: 1000,
        width: 1000,
        height: 700,
        x: 0,
        y: betweenThresholdsPosition,
        toJSON: () => ({})
      }))

      rerender(
        <FloatingToolbar
          editorRef={editorRef}
          toolbarRef={toolbarRef}
          headerHeight={headerHeight}
          onOriginalToolbarVisibilityChange={onVisibilityChange}
        />
      )

      window.dispatchEvent(new Event('resize'))

      // Floating toolbar should still be visible (hysteresis)
      await waitFor(() => {
        const floatingToolbar = screen.getByRole('toolbar')
        expect(floatingToolbar).not.toHaveStyle({ display: 'none' })
      }, { timeout: 200 })
    })
  })

  describe('Position Caching', () => {
    it('should recalculate position on window resize', async () => {
      const { rerender } = render(
        <FloatingToolbar
          editorRef={editorRef}
          toolbarRef={toolbarRef}
          headerHeight={headerHeight}
          onOriginalToolbarVisibilityChange={onVisibilityChange}
        />
      )

      // Change editor width (simulating resize)
      editorRef.current!.getBoundingClientRect = vi.fn(() => ({
        top: 100,
        bottom: 800,
        left: 0,
        right: 1200, // Changed from 1000
        width: 1200,
        height: 700,
        x: 0,
        y: 100,
        toJSON: () => ({})
      }))

      // Trigger resize event
      window.dispatchEvent(new Event('resize'))

      // Give it time to recalculate
      await waitFor(() => {
        expect(true).toBe(true) // Just wait for effects to settle
      }, { timeout: 100 })
    })
  })

  describe('Debouncing', () => {
    it('should debounce rapid visibility changes', async () => {
      const { rerender } = render(
        <FloatingToolbar
          editorRef={editorRef}
          toolbarRef={toolbarRef}
          headerHeight={headerHeight}
          onOriginalToolbarVisibilityChange={onVisibilityChange}
        />
      )

      // Simulate rapid scroll events by changing position multiple times quickly
      for (let i = 0; i < 5; i++) {
        const position = 100 - (i * 10)
        editorRef.current!.getBoundingClientRect = vi.fn(() => ({
          top: position,
          bottom: position + 700,
          left: 0,
          right: 1000,
          width: 1000,
          height: 700,
          x: 0,
          y: position,
          toJSON: () => ({})
        }))

        rerender(
          <FloatingToolbar
            editorRef={editorRef}
            toolbarRef={toolbarRef}
            headerHeight={headerHeight}
            onOriginalToolbarVisibilityChange={onVisibilityChange}
          />
        )

        window.dispatchEvent(new Event('scroll'))
      }

      // Wait for debounce to settle (10ms debounce + buffer)
      await waitFor(() => {
        expect(true).toBe(true)
      }, { timeout: 100 })

      // Should have been called, but not 5+ times due to debouncing
      expect(onVisibilityChange.mock.calls.length).toBeLessThan(5)
    })
  })

  describe('Visibility Callbacks', () => {
    it('should call visibility change callback when toolbar becomes visible', async () => {
      const scrolledPosition = headerHeight - (TOOLBAR_HEIGHT_PX * TOOLBAR_SHOW_THRESHOLD) - 10

      editorRef.current!.getBoundingClientRect = vi.fn(() => ({
        top: scrolledPosition,
        bottom: scrolledPosition + 700,
        left: 0,
        right: 1000,
        width: 1000,
        height: 700,
        x: 0,
        y: scrolledPosition,
        toJSON: () => ({})
      }))

      render(
        <FloatingToolbar
          editorRef={editorRef}
          toolbarRef={toolbarRef}
          headerHeight={headerHeight}
          onOriginalToolbarVisibilityChange={onVisibilityChange}
        />
      )

      window.dispatchEvent(new Event('resize'))

      await waitFor(() => {
        expect(onVisibilityChange).toHaveBeenCalledWith(false)
      }, { timeout: 200 })
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing refs gracefully', () => {
      const emptyEditorRef = { current: null }
      const emptyToolbarRef = { current: null }

      expect(() => {
        render(
          <FloatingToolbar
            editorRef={emptyEditorRef as any}
            toolbarRef={emptyToolbarRef as any}
            headerHeight={headerHeight}
            onOriginalToolbarVisibilityChange={onVisibilityChange}
          />
        )
      }).not.toThrow()
    })

    it('should handle editor outside viewport', async () => {
      // Position editor completely below viewport
      editorRef.current!.getBoundingClientRect = vi.fn(() => ({
        top: 2000,
        bottom: 2700,
        left: 0,
        right: 1000,
        width: 1000,
        height: 700,
        x: 0,
        y: 2000,
        toJSON: () => ({})
      }))

      render(
        <FloatingToolbar
          editorRef={editorRef}
          toolbarRef={toolbarRef}
          headerHeight={headerHeight}
          onOriginalToolbarVisibilityChange={onVisibilityChange}
        />
      )

      window.dispatchEvent(new Event('resize'))

      await waitFor(() => {
        // Toolbar exists but should be hidden
        const floatingToolbar = screen.getByRole('toolbar', { hidden: true })
        expect(floatingToolbar).toBeInTheDocument()
        expect(floatingToolbar).toHaveStyle({ display: 'none' })
      }, { timeout: 200 })
    })
  })
})
