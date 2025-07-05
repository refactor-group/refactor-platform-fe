import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useCurrentOrganization } from '@/lib/hooks/use-current-organization'
import { TestProviders } from '@/test-utils/providers'

describe('useCurrentOrganization', () => {
  it('should initialize with empty organization ID', () => {
    const { result } = renderHook(() => useCurrentOrganization(), {
      wrapper: TestProviders
    })

    expect(result.current.currentOrganizationId).toBe('')
  })

  it('should update organization ID when set', () => {
    const { result } = renderHook(() => useCurrentOrganization(), {
      wrapper: TestProviders
    })

    act(() => {
      result.current.setCurrentOrganizationId('org-456')
    })

    expect(result.current.currentOrganizationId).toBe('org-456')
  })

  it('should reset organization state', () => {
    const { result } = renderHook(() => useCurrentOrganization(), {
      wrapper: TestProviders
    })

    // Set organization ID
    act(() => {
      result.current.setCurrentOrganizationId('org-456')
    })
    expect(result.current.currentOrganizationId).toBe('org-456')

    // Reset state
    act(() => {
      result.current.resetOrganizationState()
    })
    expect(result.current.currentOrganizationId).toBe('')
  })

  it('should maintain state across multiple calls', () => {
    const TestWrapper = ({ children }: { children: React.ReactNode }) => (
      <TestProviders>{children}</TestProviders>
    )
    
    const { result: result1 } = renderHook(() => useCurrentOrganization(), {
      wrapper: TestWrapper
    })

    act(() => {
      result1.current.setCurrentOrganizationId('org-shared')
    })

    // Create second hook with same wrapper
    const { result: result2 } = renderHook(() => useCurrentOrganization(), {
      wrapper: TestWrapper
    })

    // Both hooks should see the same state
    expect(result1.current.currentOrganizationId).toBe('org-shared')
    expect(result2.current.currentOrganizationId).toBe('org-shared')
  })
})