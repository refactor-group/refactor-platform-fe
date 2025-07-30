import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DateTime } from 'ts-luxon'
import { CoachingSessionApi, useCoachingSessionList } from '@/lib/api/coaching-sessions'
import { EntityApi } from '@/lib/api/entity-api'
import { renderHook } from '@testing-library/react'
import { TestProviders } from '@/test-utils/providers'

// Mock EntityApi
vi.mock('@/lib/api/entity-api', () => ({
  EntityApi: {
    listFn: vi.fn(),
    useEntityList: vi.fn(),
  },
}))

// Mock site config to provide a proper base URL
vi.mock('@/site.config', () => ({
  siteConfig: {
    env: {
      backendServiceURL: 'http://localhost:3000',
    },
  },
}))

describe('CoachingSessionApi - Sorting Functionality', () => {
  const mockRelationshipId = 'rel-123'
  const mockFromDate = DateTime.fromISO('2025-07-01')
  const mockToDate = DateTime.fromISO('2025-07-31')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should include both sort_by and sort_order parameters when provided', async () => {
    const mockSessions = [
      { id: 'session-1', date: '2025-07-15T10:00:00Z' },
      { id: 'session-2', date: '2025-07-20T14:00:00Z' },
    ]
    
    vi.mocked(EntityApi.listFn).mockResolvedValue(mockSessions)

    await CoachingSessionApi.list(
      mockRelationshipId,
      mockFromDate,
      mockToDate,
      'date',
      'desc'
    )

    expect(EntityApi.listFn).toHaveBeenCalledWith('http://localhost:3000/coaching_sessions', {
      params: {
        coaching_relationship_id: mockRelationshipId,
        from_date: '2025-07-01',
        to_date: '2025-07-31',
        sort_by: 'date',
        sort_order: 'desc',
      },
    })
  })

  it('should omit sort parameters when not provided', async () => {
    const mockSessions = []
    vi.mocked(EntityApi.listFn).mockResolvedValue(mockSessions)

    await CoachingSessionApi.list(
      mockRelationshipId,
      mockFromDate,
      mockToDate
    )

    expect(EntityApi.listFn).toHaveBeenCalledWith('http://localhost:3000/coaching_sessions', {
      params: {
        coaching_relationship_id: mockRelationshipId,
        from_date: '2025-07-01',
        to_date: '2025-07-31',
      },
    })
  })
})

describe('useCoachingSessionList hook - Sorting Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should pass sorting parameters to EntityApi.useEntityList', () => {
    const mockUseEntityListReturn = {
      entities: [],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    }
    
    vi.mocked(EntityApi.useEntityList).mockReturnValue(mockUseEntityListReturn)

    renderHook(
      () => useCoachingSessionList(
        'rel-123',
        DateTime.fromISO('2025-07-01'),
        DateTime.fromISO('2025-07-31'),
        'date',
        'desc'
      ),
      { wrapper: TestProviders }
    )

    expect(EntityApi.useEntityList).toHaveBeenCalledWith(
      'http://localhost:3000/coaching_sessions',
      expect.any(Function), // fetcher function
      {
        coaching_relationship_id: 'rel-123',
        from_date: '2025-07-01',
        to_date: '2025-07-31',
        sort_by: 'date',
        sort_order: 'desc',
      }
    )
  })
})