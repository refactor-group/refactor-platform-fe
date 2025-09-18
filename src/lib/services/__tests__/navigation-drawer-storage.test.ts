import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NavigationDrawerStorage } from '../navigation-drawer-storage'
import { NavigationDrawerState, StateChangeSource } from '@/types/navigation-drawer'

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage
})

describe('NavigationDrawerStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setUserIntent', () => {
    it('should store user intent when source is UserAction', () => {
      const result = NavigationDrawerStorage.setUserIntent(
        NavigationDrawerState.Collapsed,
        StateChangeSource.UserAction
      )

      expect(result).toBe(true)
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'nav_drawer_user_intent',
        'collapsed'
      )
    })

    it('should not store when source is not UserAction', () => {
      const result = NavigationDrawerStorage.setUserIntent(
        NavigationDrawerState.Collapsed,
        StateChangeSource.ResponsiveResize
      )

      expect(result).toBe(false)
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled()
    })
  })

  describe('getUserIntent', () => {
    it('should return stored intent when valid', () => {
      mockSessionStorage.getItem.mockReturnValue('expanded')

      const result = NavigationDrawerStorage.getUserIntent()

      expect(result).toBe(NavigationDrawerState.Expanded)
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('nav_drawer_user_intent')
    })

    it('should return null for invalid stored value', () => {
      mockSessionStorage.getItem.mockReturnValue('invalid')

      const result = NavigationDrawerStorage.getUserIntent()

      expect(result).toBe(null)
    })

    it('should return null when no stored value', () => {
      mockSessionStorage.getItem.mockReturnValue(null)

      const result = NavigationDrawerStorage.getUserIntent()

      expect(result).toBe(null)
    })
  })

  describe('clearUserIntent', () => {
    it('should remove stored intent', () => {
      NavigationDrawerStorage.clearUserIntent()

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('nav_drawer_user_intent')
    })
  })
})