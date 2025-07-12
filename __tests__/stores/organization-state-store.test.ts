import { describe, it, expect, beforeEach } from 'vitest'
import { createOrganizationStateStore } from '@/lib/stores/organization-state-store'

describe('OrganizationStateStore', () => {
  let store: ReturnType<typeof createOrganizationStateStore>

  beforeEach(() => {
    store = createOrganizationStateStore()
  })

  it('should initialize with empty organization ID', () => {
    expect(store.getState().currentOrganizationId).toBe('')
  })

  it('should set and retrieve current organization ID', () => {
    store.getState().setCurrentOrganizationId('org-123')
    
    expect(store.getState().currentOrganizationId).toBe('org-123')
  })

  it('should reset organization state to defaults', () => {
    // Set some state
    store.getState().setCurrentOrganizationId('org-123')
    
    // Verify state was set
    expect(store.getState().currentOrganizationId).toBe('org-123')
    
    // Reset state
    store.getState().resetOrganizationState()
    
    // Verify state was reset
    expect(store.getState().currentOrganizationId).toBe('')
  })

  it('should handle multiple organization ID updates', () => {
    store.getState().setCurrentOrganizationId('org-1')
    expect(store.getState().currentOrganizationId).toBe('org-1')
    
    store.getState().setCurrentOrganizationId('org-2')
    expect(store.getState().currentOrganizationId).toBe('org-2')
    
    store.getState().setCurrentOrganizationId('org-3')
    expect(store.getState().currentOrganizationId).toBe('org-3')
  })
})