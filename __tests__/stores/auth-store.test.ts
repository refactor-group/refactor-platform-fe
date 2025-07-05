import { describe, it, expect, beforeEach } from 'vitest'
import { createAuthStore } from '@/lib/stores/auth-store'
import { defaultUserSession } from '@/types/user-session'

describe('AuthStore', () => {
  let store: ReturnType<typeof createAuthStore>

  beforeEach(() => {
    store = createAuthStore()
  })

  it('should initialize with logged out state', () => {
    const state = store.getState()
    expect(state.isLoggedIn).toBe(false)
    expect(state.userId).toBe('')
    expect(state.userSession).toEqual(defaultUserSession())
    expect(state.isCurrentCoach).toBe(false)
    expect(state.isACoach).toBe(false)
  })

  it('should handle user login', () => {
    const userId = 'user-123'
    const userSession = {
      ...defaultUserSession(),
      email: 'test@example.com'
    }

    store.getState().login(userId, userSession)
    
    const state = store.getState()
    expect(state.isLoggedIn).toBe(true)
    expect(state.userId).toBe(userId)
    expect(state.userSession).toEqual(userSession)
  })

  it('should handle user logout', () => {
    // First login
    store.getState().login('user-123', defaultUserSession())
    expect(store.getState().isLoggedIn).toBe(true)
    
    // Then logout
    store.getState().logout()
    
    const state = store.getState()
    expect(state.isLoggedIn).toBe(false)
    expect(state.userId).toBe('')
    expect(state.userSession).toEqual(defaultUserSession())
    expect(state.isCurrentCoach).toBe(false)
    expect(state.isACoach).toBe(false)
  })

  it('should handle coach status correctly', () => {
    const userId = 'user-123'
    
    // Login first
    store.getState().login(userId, defaultUserSession())
    
    // Set as current coach with same user ID
    store.getState().setIsCurrentCoach(userId)
    expect(store.getState().isCurrentCoach).toBe(true)
    expect(store.getState().getIsCurrentCoach()).toBe(true)
    
    // Set as current coach with different user ID
    store.getState().setIsCurrentCoach('different-user')
    expect(store.getState().isCurrentCoach).toBe(false)
    expect(store.getState().getIsCurrentCoach()).toBe(false)
  })

  it('should handle isACoach status', () => {
    store.getState().setIsACoach(true)
    expect(store.getState().isACoach).toBe(true)
    expect(store.getState().getIsACoach()).toBe(true)
    
    store.getState().setIsACoach(false)
    expect(store.getState().isACoach).toBe(false)
    expect(store.getState().getIsACoach()).toBe(false)
  })
})