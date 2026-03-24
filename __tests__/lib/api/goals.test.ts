import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GoalApi, useGoalList, useGoalsBySession, useBatchSessionGoals } from '@/lib/api/goals'
import { EntityApi } from '@/lib/api/entity-api'
import { renderHook, waitFor } from '@testing-library/react'
import { TestProviders } from '@/test-utils/providers'
import { sessionGuard } from '@/lib/auth/session-guard'

// Mock EntityApi
vi.mock('@/lib/api/entity-api', () => ({
  EntityApi: {
    listFn: vi.fn(),
    listNestedFn: vi.fn(),
    getFn: vi.fn(),
    createFn: vi.fn(),
    updateFn: vi.fn(),
    deleteFn: vi.fn(),
    useEntityList: vi.fn(),
    useEntityMutation: vi.fn(),
  },
}))

// Mock sessionGuard for batch endpoint tests
vi.mock('@/lib/auth/session-guard', () => ({
  sessionGuard: {
    get: vi.fn(),
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

describe('GoalApi.list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends coaching_relationship_id as query param', async () => {
    vi.mocked(EntityApi.listFn).mockResolvedValue([])

    await GoalApi.list('rel-123')

    expect(EntityApi.listFn).toHaveBeenCalledWith('http://localhost:3000/goals', {
      params: {
        coaching_relationship_id: 'rel-123',
      },
    })
  })

  it('does not send coaching_session_id', async () => {
    vi.mocked(EntityApi.listFn).mockResolvedValue([])

    await GoalApi.list('rel-123')

    const callArgs = vi.mocked(EntityApi.listFn).mock.calls[0]
    expect(callArgs[1].params).not.toHaveProperty('coaching_session_id')
  })

  it('includes sort params when provided', async () => {
    vi.mocked(EntityApi.listFn).mockResolvedValue([])

    await GoalApi.list('rel-123', 'title', 'asc')

    expect(EntityApi.listFn).toHaveBeenCalledWith('http://localhost:3000/goals', {
      params: {
        coaching_relationship_id: 'rel-123',
        sort_by: 'title',
        sort_order: 'asc',
      },
    })
  })

  it('omits sort params when not provided', async () => {
    vi.mocked(EntityApi.listFn).mockResolvedValue([])

    await GoalApi.list('rel-123')

    const callArgs = vi.mocked(EntityApi.listFn).mock.calls[0]
    expect(callArgs[1].params).not.toHaveProperty('sort_by')
    expect(callArgs[1].params).not.toHaveProperty('sort_order')
  })
})

describe('useGoalList hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes coaching_relationship_id to EntityApi.useEntityList', () => {
    const mockReturn = {
      entities: [],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    }

    vi.mocked(EntityApi.useEntityList).mockReturnValue(mockReturn)

    renderHook(
      () => useGoalList('rel-456'),
      { wrapper: TestProviders }
    )

    expect(EntityApi.useEntityList).toHaveBeenCalledWith(
      'http://localhost:3000/goals',
      expect.any(Function),
      'rel-456'
    )
  })

  it('passes null to EntityApi.useEntityList when relationship ID is null', () => {
    const mockReturn = {
      entities: [],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    }

    vi.mocked(EntityApi.useEntityList).mockReturnValue(mockReturn)

    renderHook(
      () => useGoalList(null),
      { wrapper: TestProviders }
    )

    expect(EntityApi.useEntityList).toHaveBeenCalledWith(
      'http://localhost:3000/goals',
      expect.any(Function),
      null
    )
  })
})

describe('GoalApi.listNested', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches goals nested under the coaching session endpoint', async () => {
    vi.mocked(EntityApi.listNestedFn).mockResolvedValue([])

    await GoalApi.listNested('session-123')

    expect(EntityApi.listNestedFn).toHaveBeenCalledWith(
      'http://localhost:3000/coaching_sessions',
      'session-123',
      'goals',
      {}
    )
  })
})

describe('useGoalsBySession hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes session-scoped URL to EntityApi.useEntityList', () => {
    const mockReturn = {
      entities: [],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    }

    vi.mocked(EntityApi.useEntityList).mockReturnValue(mockReturn)

    renderHook(
      () => useGoalsBySession('session-789'),
      { wrapper: TestProviders }
    )

    expect(EntityApi.useEntityList).toHaveBeenCalledWith(
      'http://localhost:3000/coaching_sessions/session-789/goals',
      expect.any(Function),
      'session-789'
    )
  })

  it('returns goals array from entities', () => {
    const mockGoals = [
      { id: 'goal-1', title: 'Test Goal' },
      { id: 'goal-2', title: 'Another Goal' },
    ]

    vi.mocked(EntityApi.useEntityList).mockReturnValue({
      entities: mockGoals as any,
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    })

    const { result } = renderHook(
      () => useGoalsBySession('session-789'),
      { wrapper: TestProviders }
    )

    expect(result.current.goals).toEqual(mockGoals)
    expect(result.current.isLoading).toBe(false)
  })
})

describe('useBatchSessionGoals hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty object when relationship ID is null', () => {
    const { result } = renderHook(
      () => useBatchSessionGoals(null),
      { wrapper: TestProviders }
    )

    expect(result.current.sessionGoals).toEqual({})
    expect(sessionGuard.get).not.toHaveBeenCalled()
  })

  it('fetches batch goals keyed by session ID', async () => {
    const mockResponse = {
      data: {
        data: {
          session_goals: {
            'session-1': [{ id: 'goal-A', title: 'Goal A' }],
            'session-2': [{ id: 'goal-A', title: 'Goal A' }, { id: 'goal-B', title: 'Goal B' }],
          },
        },
      },
    }

    vi.mocked(sessionGuard.get).mockResolvedValue(mockResponse as any)

    const { result } = renderHook(
      () => useBatchSessionGoals('rel-123'),
      { wrapper: TestProviders }
    )

    await waitFor(() => {
      expect(result.current.sessionGoals).toEqual(mockResponse.data.data.session_goals)
    })

    expect(sessionGuard.get).toHaveBeenCalledWith(
      'http://localhost:3000/coaching_sessions/goals',
      { params: { coaching_relationship_id: 'rel-123' } }
    )
  })

  it('passes coaching_relationship_id as query param to batch endpoint', async () => {
    vi.mocked(sessionGuard.get).mockResolvedValue({
      data: { data: { session_goals: {} } },
    } as any)

    renderHook(
      () => useBatchSessionGoals('rel-456'),
      { wrapper: TestProviders }
    )

    await waitFor(() => {
      expect(sessionGuard.get).toHaveBeenCalledWith(
        'http://localhost:3000/coaching_sessions/goals',
        { params: { coaching_relationship_id: 'rel-456' } }
      )
    })
  })
})
