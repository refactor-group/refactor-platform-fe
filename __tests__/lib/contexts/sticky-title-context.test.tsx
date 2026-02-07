import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { ReactNode } from 'react'
import { StickyTitleProvider, useStickyTitle } from '@/lib/contexts/sticky-title-context'

const wrapper = ({ children }: { children: ReactNode }) => (
  <StickyTitleProvider>{children}</StickyTitleProvider>
)

/**
 * Test Suite: StickyTitleProvider & useStickyTitle
 *
 * Validates the context provides correct defaults, updates state via setters,
 * and returns null when used outside the provider.
 */
describe('StickyTitleProvider / useStickyTitle', () => {
  it('should return null when used outside the provider', () => {
    const { result } = renderHook(() => useStickyTitle())
    expect(result.current).toBeNull()
  })

  it('should provide default values inside the provider', () => {
    const { result } = renderHook(() => useStickyTitle(), { wrapper })

    expect(result.current).not.toBeNull()
    expect(result.current!.titleData).toBeNull()
    expect(result.current!.isVisible).toBe(false)
  })

  it('should update titleData via setTitleData', () => {
    const { result } = renderHook(() => useStickyTitle(), { wrapper })

    act(() => {
      result.current!.setTitleData({ names: 'Alice / Bob', date: 'Feb 7, 2026 10:00 AM CST' })
    })

    expect(result.current!.titleData).toEqual({
      names: 'Alice / Bob',
      date: 'Feb 7, 2026 10:00 AM CST',
    })
  })

  it('should update visibility via setVisible', () => {
    const { result } = renderHook(() => useStickyTitle(), { wrapper })

    act(() => {
      result.current!.setVisible(true)
    })

    expect(result.current!.isVisible).toBe(true)

    act(() => {
      result.current!.setVisible(false)
    })

    expect(result.current!.isVisible).toBe(false)
  })

  it('should clear titleData when set to null', () => {
    const { result } = renderHook(() => useStickyTitle(), { wrapper })

    act(() => {
      result.current!.setTitleData({ names: 'Alice / Bob', date: 'Feb 7, 2026' })
    })
    expect(result.current!.titleData).not.toBeNull()

    act(() => {
      result.current!.setTitleData(null)
    })
    expect(result.current!.titleData).toBeNull()
  })
})
