import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useAutoSelectSingleRelationship } from '@/lib/hooks/use-auto-select-single-relationship'
import type { CoachingRelationshipWithUserNames } from '@/types/coaching-relationship'
import { createMockRelationship } from '../test-utils'

describe('useAutoSelectSingleRelationship', () => {
  it('should not auto-select when loading', () => {
    const mockSetCurrentId = vi.fn()
    const mockOnSelect = vi.fn()
    const relationships: CoachingRelationshipWithUserNames[] = [
      createMockRelationship({ id: 'rel-1', coach_id: 'coach-1', coachee_id: 'coachee-1' })
    ]

    renderHook(() =>
      useAutoSelectSingleRelationship(
        relationships,
        true, // isLoading = true
        '',
        mockSetCurrentId,
        mockOnSelect
      )
    )

    expect(mockSetCurrentId).not.toHaveBeenCalled()
    expect(mockOnSelect).not.toHaveBeenCalled()
  })

  it('should not auto-select when relationships is undefined', () => {
    const mockSetCurrentId = vi.fn()
    const mockOnSelect = vi.fn()

    renderHook(() =>
      useAutoSelectSingleRelationship(
        undefined,
        false,
        '',
        mockSetCurrentId,
        mockOnSelect
      )
    )

    expect(mockSetCurrentId).not.toHaveBeenCalled()
    expect(mockOnSelect).not.toHaveBeenCalled()
  })

  it('should not auto-select when multiple relationships exist', () => {
    const mockSetCurrentId = vi.fn()
    const mockOnSelect = vi.fn()
    const relationships: CoachingRelationshipWithUserNames[] = [
      createMockRelationship({ id: 'rel-1', coach_id: 'coach-1', coachee_id: 'coachee-1' }),
      createMockRelationship({ id: 'rel-2', coach_id: 'coach-2', coachee_id: 'coachee-2' })
    ]

    renderHook(() =>
      useAutoSelectSingleRelationship(
        relationships,
        false,
        '',
        mockSetCurrentId,
        mockOnSelect
      )
    )

    expect(mockSetCurrentId).not.toHaveBeenCalled()
    expect(mockOnSelect).not.toHaveBeenCalled()
  })

  it('should not auto-select when a relationship is already selected', () => {
    const mockSetCurrentId = vi.fn()
    const mockOnSelect = vi.fn()
    const relationships: CoachingRelationshipWithUserNames[] = [
      createMockRelationship({ id: 'rel-1', coach_id: 'coach-1', coachee_id: 'coachee-1' })
    ]

    renderHook(() =>
      useAutoSelectSingleRelationship(
        relationships,
        false,
        'rel-1', // currentId already set
        mockSetCurrentId,
        mockOnSelect
      )
    )

    expect(mockSetCurrentId).not.toHaveBeenCalled()
    expect(mockOnSelect).not.toHaveBeenCalled()
  })

  it('should auto-select when conditions are met: single relationship, not loading, no current selection', () => {
    const mockSetCurrentId = vi.fn()
    const mockOnSelect = vi.fn()
    const relationships: CoachingRelationshipWithUserNames[] = [
      createMockRelationship({ id: 'rel-1', coach_id: 'coach-1', coachee_id: 'coachee-1' })
    ]

    renderHook(() =>
      useAutoSelectSingleRelationship(
        relationships,
        false, // not loading
        '', // no current selection
        mockSetCurrentId,
        mockOnSelect
      )
    )

    expect(mockSetCurrentId).toHaveBeenCalledWith('rel-1')
    expect(mockOnSelect).toHaveBeenCalledWith('rel-1')
  })

  it('should work without onSelect callback', () => {
    const mockSetCurrentId = vi.fn()
    const relationships: CoachingRelationshipWithUserNames[] = [
      createMockRelationship({ id: 'rel-1', coach_id: 'coach-1', coachee_id: 'coachee-1' })
    ]

    renderHook(() =>
      useAutoSelectSingleRelationship(
        relationships,
        false,
        '',
        mockSetCurrentId
        // no onSelect callback
      )
    )

    expect(mockSetCurrentId).toHaveBeenCalledWith('rel-1')
  })

  it('should handle error in auto-selection gracefully', () => {
    const mockSetCurrentId = vi.fn(() => {
      throw new Error('Test error')
    })
    const mockOnSelect = vi.fn()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    const relationships: CoachingRelationshipWithUserNames[] = [
      createMockRelationship({ id: 'rel-1', coach_id: 'coach-1', coachee_id: 'coachee-1' })
    ]

    renderHook(() =>
      useAutoSelectSingleRelationship(
        relationships,
        false,
        '',
        mockSetCurrentId,
        mockOnSelect
      )
    )

    expect(mockSetCurrentId).toHaveBeenCalledWith('rel-1')
    expect(mockOnSelect).not.toHaveBeenCalled() // Should not be called due to error
    expect(consoleSpy).toHaveBeenCalledWith('Auto-selection failed:', expect.any(Error))
    
    consoleSpy.mockRestore()
  })

  it('should re-run effect when dependencies change', () => {
    const mockSetCurrentId = vi.fn()
    const mockOnSelect = vi.fn()
    
    const initialRelationships: CoachingRelationshipWithUserNames[] = []
    
    const { rerender } = renderHook(
      ({ relationships, isLoading, currentId }) =>
        useAutoSelectSingleRelationship(
          relationships,
          isLoading,
          currentId,
          mockSetCurrentId,
          mockOnSelect
        ),
      {
        initialProps: {
          relationships: initialRelationships,
          isLoading: true,
          currentId: ''
        }
      }
    )

    // Initially should not auto-select (loading = true)
    expect(mockSetCurrentId).not.toHaveBeenCalled()

    // Change to single relationship and not loading
    const newRelationships: CoachingRelationshipWithUserNames[] = [
      createMockRelationship({ id: 'rel-1', coach_id: 'coach-1', coachee_id: 'coachee-1' })
    ]

    rerender({
      relationships: newRelationships,
      isLoading: false,
      currentId: ''
    })

    expect(mockSetCurrentId).toHaveBeenCalledWith('rel-1')
    expect(mockOnSelect).toHaveBeenCalledWith('rel-1')
  })

  it('should not auto-select when relationships array is empty', () => {
    const mockSetCurrentId = vi.fn()
    const mockOnSelect = vi.fn()
    const relationships: CoachingRelationshipWithUserNames[] = []

    renderHook(() =>
      useAutoSelectSingleRelationship(
        relationships,
        false,
        '',
        mockSetCurrentId,
        mockOnSelect
      )
    )

    expect(mockSetCurrentId).not.toHaveBeenCalled()
    expect(mockOnSelect).not.toHaveBeenCalled()
  })
})