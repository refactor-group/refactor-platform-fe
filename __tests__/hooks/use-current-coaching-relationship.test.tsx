import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useCurrentCoachingRelationship } from '@/lib/hooks/use-current-coaching-relationship'
import { TestProviders } from '@/test-utils/providers'

describe('useCurrentCoachingRelationship', () => {
  it('should initialize with empty coaching relationship ID', () => {
    const { result } = renderHook(() => useCurrentCoachingRelationship(), {
      wrapper: TestProviders
    })

    expect(result.current.currentCoachingRelationshipId).toBe('')
  })

  it('should update coaching relationship ID when set', () => {
    const { result } = renderHook(() => useCurrentCoachingRelationship(), {
      wrapper: TestProviders
    })

    act(() => {
      result.current.setCurrentCoachingRelationshipId('rel-789')
    })

    expect(result.current.currentCoachingRelationshipId).toBe('rel-789')
  })

  it('should reset coaching relationship state', () => {
    const { result } = renderHook(() => useCurrentCoachingRelationship(), {
      wrapper: TestProviders
    })

    // Set coaching relationship ID
    act(() => {
      result.current.setCurrentCoachingRelationshipId('rel-789')
    })
    expect(result.current.currentCoachingRelationshipId).toBe('rel-789')

    // Reset state
    act(() => {
      result.current.resetCoachingRelationshipState()
    })
    expect(result.current.currentCoachingRelationshipId).toBe('')
  })

  it('should maintain state across multiple calls', () => {
    const TestWrapper = ({ children }: { children: React.ReactNode }) => (
      <TestProviders>{children}</TestProviders>
    )
    
    const { result: result1 } = renderHook(() => useCurrentCoachingRelationship(), {
      wrapper: TestWrapper
    })

    act(() => {
      result1.current.setCurrentCoachingRelationshipId('rel-shared')
    })

    // Create second hook with same wrapper
    const { result: result2 } = renderHook(() => useCurrentCoachingRelationship(), {
      wrapper: TestWrapper
    })

    // Both hooks should see the same state
    expect(result1.current.currentCoachingRelationshipId).toBe('rel-shared')
    expect(result2.current.currentCoachingRelationshipId).toBe('rel-shared')
  })
})