import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import GlobalError from '@/app/global-error'

// ---------------------------------------------------------------------------
// Integration tests for global-error.tsx
//
// Tests the auto-reload behavior for ChunkLoadErrors and the
// sessionStorage-based infinite loop prevention.
// ---------------------------------------------------------------------------

// Mock window.location.reload — jsdom doesn't support real navigation
const reloadMock = vi.fn()

beforeEach(() => {
  sessionStorage.clear()
  reloadMock.mockClear()

  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: reloadMock },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  sessionStorage.clear()
})

function chunkLoadError(message = 'Loading chunk abc123 failed'): Error & { digest?: string } {
  const error = new Error(message)
  error.name = 'ChunkLoadError'
  return error
}

function dynamicImportError(): Error & { digest?: string } {
  return new Error('Failed to fetch dynamically imported module: /path/to/chunk.js')
}

function genericError(): Error & { digest?: string } {
  return new Error('Cannot read properties of undefined')
}

describe('GlobalError', () => {
  describe('ChunkLoadError auto-reload', () => {
    it('reloads the page on first ChunkLoadError', async () => {
      const reset = vi.fn()

      render(<GlobalError error={chunkLoadError()} reset={reset} />)

      await waitFor(() => {
        expect(reloadMock).toHaveBeenCalledTimes(1)
      })

      // Flag should be set to prevent a second reload
      expect(sessionStorage.getItem('__chunk_error_reloaded')).toBe('true')
    })

    it('reloads on "Failed to fetch dynamically imported module" error', async () => {
      const reset = vi.fn()

      render(<GlobalError error={dynamicImportError()} reset={reset} />)

      await waitFor(() => {
        expect(reloadMock).toHaveBeenCalledTimes(1)
      })
    })

    it('does NOT reload a second time (prevents infinite loop)', async () => {
      const reset = vi.fn()

      // Simulate: a reload already happened
      sessionStorage.setItem('__chunk_error_reloaded', 'true')

      render(<GlobalError error={chunkLoadError()} reset={reset} />)

      // Wait for the useEffect to run
      await waitFor(() => {
        // The flag should be cleared so the next deploy can try again
        expect(sessionStorage.getItem('__chunk_error_reloaded')).toBeNull()
      })

      // No reload should have been triggered
      expect(reloadMock).not.toHaveBeenCalled()
    })

    it('shows "A new version is available" message for chunk errors', () => {
      // Pre-set flag so the useEffect doesn't trigger reload during render
      sessionStorage.setItem('__chunk_error_reloaded', 'true')

      render(<GlobalError error={chunkLoadError()} reset={vi.fn()} />)

      expect(screen.getByText('A new version is available. Reloading...')).toBeInTheDocument()
    })

    it('does NOT show the "Try again" button for chunk errors', () => {
      sessionStorage.setItem('__chunk_error_reloaded', 'true')

      render(<GlobalError error={chunkLoadError()} reset={vi.fn()} />)

      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    })
  })

  describe('Non-chunk error fallback UI', () => {
    it('does NOT auto-reload for generic errors', async () => {
      const reset = vi.fn()

      render(<GlobalError error={genericError()} reset={reset} />)

      // Give useEffect a chance to run
      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      })

      expect(reloadMock).not.toHaveBeenCalled()
    })

    it('shows "An unexpected error occurred" message', () => {
      render(<GlobalError error={genericError()} reset={vi.fn()} />)

      expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument()
    })

    it('shows "Try again" button that calls reset', async () => {
      const reset = vi.fn()

      render(<GlobalError error={genericError()} reset={reset} />)

      const button = screen.getByRole('button', { name: 'Try again' })
      expect(button).toBeInTheDocument()

      await userEvent.click(button)
      expect(reset).toHaveBeenCalledTimes(1)
    })

    it('does NOT set the sessionStorage flag for non-chunk errors', async () => {
      render(<GlobalError error={genericError()} reset={vi.fn()} />)

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      })

      expect(sessionStorage.getItem('__chunk_error_reloaded')).toBeNull()
    })
  })

  describe('sessionStorage lifecycle', () => {
    it('clears the flag after skipping reload so next deploy can retry', async () => {
      sessionStorage.setItem('__chunk_error_reloaded', 'true')

      render(<GlobalError error={chunkLoadError()} reset={vi.fn()} />)

      await waitFor(() => {
        expect(sessionStorage.getItem('__chunk_error_reloaded')).toBeNull()
      })
    })

    it('sets the flag before triggering reload', async () => {
      render(<GlobalError error={chunkLoadError()} reset={vi.fn()} />)

      await waitFor(() => {
        expect(reloadMock).toHaveBeenCalled()
      })

      // Flag was set before reload was called
      expect(sessionStorage.getItem('__chunk_error_reloaded')).toBe('true')
    })
  })
})
