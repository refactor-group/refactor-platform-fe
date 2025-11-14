import { describe, it, expect } from 'vitest'
import { shouldSyncRelationship } from '@/app/coaching-sessions/[id]/relationship-sync'

describe('shouldSyncRelationship', () => {
  describe('when session has no relationship ID', () => {
    it('returns false with null store', () => {
      expect(shouldSyncRelationship(undefined, null)).toBe(false)
    })

    it('returns false with populated store', () => {
      expect(shouldSyncRelationship(undefined, 'rel-123')).toBe(false)
    })
  })

  describe('when store is empty', () => {
    it('returns true (Issue #79: new tab scenario)', () => {
      expect(shouldSyncRelationship('rel-123', null)).toBe(true)
    })
  })

  describe('when relationship IDs differ', () => {
    it('returns true (Bug #228: switching between sessions)', () => {
      expect(shouldSyncRelationship('rel-456', 'rel-123')).toBe(true)
    })

    it('returns true for any different ID', () => {
      expect(shouldSyncRelationship('rel-999', 'rel-000')).toBe(true)
    })
  })

  describe('when relationship IDs match', () => {
    it('returns false (optimization: no sync needed)', () => {
      expect(shouldSyncRelationship('rel-123', 'rel-123')).toBe(false)
    })

    it('returns false for any matching ID', () => {
      expect(shouldSyncRelationship('rel-xyz', 'rel-xyz')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('handles empty string as session ID', () => {
      expect(shouldSyncRelationship('', 'rel-123')).toBe(false)
    })

    it('handles empty string in both params', () => {
      expect(shouldSyncRelationship('', '')).toBe(false)
    })
  })
})
