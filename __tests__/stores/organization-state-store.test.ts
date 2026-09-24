import { describe, it, expect, beforeEach } from 'vitest'
import { createOrganizationStateStore } from '@/lib/stores/organization-state-store'

describe('OrganizationStateStore', () => {
  let store: ReturnType<typeof createOrganizationStateStore>

  beforeEach(() => {
    localStorage.clear()
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

  describe('remembering the last organization per user', () => {
    // Automatic selections (reconciler fallback, members-page URL sync) go
    // through this setter and must not be remembered.
    it('does not remember a plain selection', () => {
      store.getState().setCurrentOrganizationId('org-2')

      expect(store.getState().lastOrganizationIdByUser).toEqual({})
    })

    it('remembers a separate organization for each user', () => {
      store.getState().rememberOrganizationForUser('user-1', 'org-2')
      store.getState().rememberOrganizationForUser('user-2', 'org-1')

      expect(store.getState().lastOrganizationIdByUser).toEqual({
        'user-1': 'org-2',
        'user-2': 'org-1',
      })
    })

    it('overwrites a user\'s earlier choice', () => {
      store.getState().rememberOrganizationForUser('user-1', 'org-1')
      store.getState().rememberOrganizationForUser('user-1', 'org-2')

      expect(store.getState().lastOrganizationIdByUser).toEqual({ 'user-1': 'org-2' })
    })

    it('keeps remembered choices through a reset', () => {
      store.getState().setCurrentOrganizationId('org-2')
      store.getState().rememberOrganizationForUser('user-1', 'org-2')

      store.getState().resetOrganizationState()

      expect(store.getState().currentOrganizationId).toBe('')
      expect(store.getState().lastOrganizationIdByUser).toEqual({ 'user-1': 'org-2' })
    })

    it('ignores empty ids', () => {
      store.getState().rememberOrganizationForUser('', 'org-1')
      store.getState().rememberOrganizationForUser('user-1', '')

      expect(store.getState().lastOrganizationIdByUser).toEqual({})
    })

    it('survives a logout followed by a reload', () => {
      store.getState().setCurrentOrganizationId('org-2')
      store.getState().rememberOrganizationForUser('user-1', 'org-2')
      store.getState().resetOrganizationState()

      const reloaded = createOrganizationStateStore()

      expect(reloaded.getState().currentOrganizationId).toBe('')
      expect(reloaded.getState().lastOrganizationIdByUser).toEqual({ 'user-1': 'org-2' })
    })

    it('rehydrates state persisted before the map existed', () => {
      localStorage.setItem(
        'organization-state-store',
        JSON.stringify({ state: { currentOrganizationId: 'org-9' }, version: 2 })
      )

      const rehydrated = createOrganizationStateStore()

      expect(rehydrated.getState().currentOrganizationId).toBe('org-9')
      expect(rehydrated.getState().lastOrganizationIdByUser).toEqual({})
    })
  })
})
