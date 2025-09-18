import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SidebarStorage } from '../sidebar-storage'
import { SidebarState, StateChangeSource } from '@/types/sidebar'

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

describe('SidebarStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setUserIntent', () => {
    it('should store user intent when source is UserAction', () => {
      const result = SidebarStorage.setUserIntent(
        SidebarState.Collapsed,
        StateChangeSource.UserAction
      )

      expect(result).toEqual({ success: true, data: true })
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'nav_drawer_user_intent',
        'collapsed'
      )
    })

    it('should not store when source is not UserAction', () => {
      const result = SidebarStorage.setUserIntent(
        SidebarState.Collapsed,
        StateChangeSource.ResponsiveResize
      )

      expect(result).toEqual({ success: true, data: false })
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled()
    })

    it('should return error when storage is unavailable', () => {
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error('Storage not available')
      })

      const result = SidebarStorage.setUserIntent(
        SidebarState.Collapsed,
        StateChangeSource.UserAction
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('STORAGE_UNAVAILABLE')
        expect(result.error.message).toBe('Session storage is not available')
      }
    })
  })

  describe('getUserIntent', () => {
    it('should return stored intent when valid', () => {
      mockSessionStorage.getItem.mockReturnValue('expanded')

      const result = SidebarStorage.getUserIntent()

      expect(result).toBe(SidebarState.Expanded)
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('nav_drawer_user_intent')
    })

    it('should return null for invalid stored value', () => {
      mockSessionStorage.getItem.mockReturnValue('invalid')

      const result = SidebarStorage.getUserIntent()

      expect(result).toBe(null)
    })

    it('should return null when no stored value', () => {
      mockSessionStorage.getItem.mockReturnValue(null)

      const result = SidebarStorage.getUserIntent()

      expect(result).toBe(null)
    })
  })

  describe('clearUserIntent', () => {
    it('should remove stored intent', () => {
      SidebarStorage.clearUserIntent()

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('nav_drawer_user_intent')
    })
  })
})