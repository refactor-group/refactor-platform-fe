import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GoalApi, useGoalList, useGoalsBySession, useBatchSessionGoals } from '@/lib/api/goals'
import { EntityApi } from '@/lib/api/entity-api'
import { EntityApiError } from '@/types/entity-api-error'
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
      expect(result.current.sessionGoals).toMatchObject(mockResponse.data.data.session_goals)
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

describe('GoalApi.linkToSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends POST to coaching_sessions/{id}/goals with goal_id body', async () => {
    vi.mocked(EntityApi.createFn).mockResolvedValue({})

    const result = await GoalApi.linkToSession('session-123', 'goal-456')

    expect(result.isOk()).toBe(true)
    expect(EntityApi.createFn).toHaveBeenCalledWith(
      'http://localhost:3000/coaching_sessions/session-123/goals',
      { goal_id: 'goal-456' }
    )
  })

  it('returns err when API call fails', async () => {
    const axiosError = new Error('Network error') as any
    axiosError.isAxiosError = true
    const apiError = new EntityApiError('POST', '/goals', axiosError)
    vi.mocked(EntityApi.createFn).mockRejectedValue(apiError)

    const result = await GoalApi.linkToSession('session-123', 'goal-456')

    expect(result.isErr()).toBe(true)
  })
})

describe('GoalApi.unlinkFromSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends DELETE to coaching_sessions/{id}/goals/{goalId}', async () => {
    vi.mocked(EntityApi.deleteFn).mockResolvedValue({})

    const result = await GoalApi.unlinkFromSession('session-123', 'goal-456')

    expect(result.isOk()).toBe(true)
    expect(EntityApi.deleteFn).toHaveBeenCalledWith(
      'http://localhost:3000/coaching_sessions/session-123/goals/goal-456'
    )
  })

  it('returns err when API call fails', async () => {
    const axiosError = new Error('Network error') as any
    axiosError.isAxiosError = true
    const apiError = new EntityApiError('DELETE', '/goals', axiosError)
    vi.mocked(EntityApi.deleteFn).mockRejectedValue(apiError)

    const result = await GoalApi.unlinkFromSession('session-123', 'goal-456')

    expect(result.isErr()).toBe(true)
  })
})

describe('goals without a description (body: null on the wire)', () => {
  const wireGoal = (id: string, body: string | null) => ({
    id,
    coaching_relationship_id: 'rel-1',
    created_in_session_id: 'sess-1',
    user_id: 'user-1',
    title: `Goal ${id}`,
    body,
    status: 'InProgress',
    status_changed_at: '2026-03-01T00:00:00Z',
    completed_at: '2026-03-01T00:00:00Z',
    target_date: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('come back from the session list with an empty body', async () => {
    vi.mocked(EntityApi.listNestedFn).mockResolvedValue([wireGoal('g1', null), wireGoal('g2', 'Details')])
    const goals = await GoalApi.listNested('sess-1')
    expect(goals.map((g) => g.body)).toEqual(['', 'Details'])
  })

  it('come back from the relationship list and a single fetch with an empty body', async () => {
    vi.mocked(EntityApi.listFn).mockResolvedValue([wireGoal('g1', null)])
    vi.mocked(EntityApi.getFn).mockResolvedValue(wireGoal('g1', null))
    expect((await GoalApi.list('rel-1'))[0].body).toBe('')
    expect((await GoalApi.get('g1')).body).toBe('')
  })

  it('come back from create and update with an empty body', async () => {
    vi.mocked(EntityApi.createFn).mockResolvedValue(wireGoal('g1', null))
    vi.mocked(EntityApi.updateFn).mockResolvedValue(wireGoal('g1', null))
    const goal = { ...wireGoal('g1', ''), body: '' } as unknown as Parameters<typeof GoalApi.create>[0]
    expect((await GoalApi.create(goal)).body).toBe('')
    expect((await GoalApi.update('g1', goal)).body).toBe('')
  })

  it('come back from the batch endpoint with an empty body', async () => {
    vi.mocked(sessionGuard.get).mockResolvedValue({
      data: { data: { session_goals: { 'sess-1': [wireGoal('g1', null)] } } },
    } as never)
    const { result } = renderHook(() => useBatchSessionGoals('rel-1'), { wrapper: TestProviders })
    await waitFor(() => expect(result.current.sessionGoals['sess-1']).toHaveLength(1))
    expect(result.current.sessionGoals['sess-1'][0].body).toBe('')
  })
})
