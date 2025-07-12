import { describe, it, expect, beforeEach } from 'vitest'
import { createCoachingRelationshipStateStore } from '@/lib/stores/coaching-relationship-state-store'

describe('CoachingRelationshipStateStore', () => {
  let store: ReturnType<typeof createCoachingRelationshipStateStore>

  beforeEach(() => {
    store = createCoachingRelationshipStateStore()
  })

  it('should initialize with empty coaching relationship ID', () => {
    expect(store.getState().currentCoachingRelationshipId).toBe('')
  })

  it('should set and retrieve current coaching relationship ID', () => {
    store.getState().setCurrentCoachingRelationshipId('rel-456')
    
    expect(store.getState().currentCoachingRelationshipId).toBe('rel-456')
  })

  it('should reset coaching relationship state to defaults', () => {
    // Set some state
    store.getState().setCurrentCoachingRelationshipId('rel-456')
    
    // Verify state was set
    expect(store.getState().currentCoachingRelationshipId).toBe('rel-456')
    
    // Reset state
    store.getState().resetCoachingRelationshipState()
    
    // Verify state was reset
    expect(store.getState().currentCoachingRelationshipId).toBe('')
  })

  it('should handle multiple coaching relationship ID updates', () => {
    store.getState().setCurrentCoachingRelationshipId('rel-1')
    expect(store.getState().currentCoachingRelationshipId).toBe('rel-1')
    
    store.getState().setCurrentCoachingRelationshipId('rel-2')
    expect(store.getState().currentCoachingRelationshipId).toBe('rel-2')
    
    store.getState().setCurrentCoachingRelationshipId('rel-3')
    expect(store.getState().currentCoachingRelationshipId).toBe('rel-3')
  })
})