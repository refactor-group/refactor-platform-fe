import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StickySessionTitle } from '@/components/ui/sticky-session-title'
import { StickyTitleProvider } from '@/lib/contexts/sticky-title-context'

/**
 * Test Suite: StickySessionTitle Component
 *
 * Validates that the compact session title renders correctly inside and
 * outside the StickyTitleProvider, and that visibility classes toggle
 * based on context state.
 */
describe('StickySessionTitle', () => {
  it('should render nothing when outside StickyTitleProvider', () => {
    const { container } = render(<StickySessionTitle />)
    expect(container.innerHTML).toBe('')
  })

  it('should render hidden state when inside provider with no title data', () => {
    const { container } = render(
      <StickyTitleProvider>
        <StickySessionTitle />
      </StickyTitleProvider>
    )

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.className).toContain('max-w-0')
    expect(wrapper.className).toContain('opacity-0')
  })
})
