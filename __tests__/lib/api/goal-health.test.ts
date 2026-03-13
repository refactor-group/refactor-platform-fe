import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Some } from 'ts-results'
import { GoalHealthApi, useGoalHealth } from '@/lib/api/goal-health'
import { GoalHealth } from '@/types/goal-health'
import { EntityApi } from '@/lib/api/entity-api'
import { renderHook } from '@testing-library/react'

vi.mock('@/lib/api/entity-api', () => ({
  EntityApi: {
    getFn: vi.fn(),
    useEntity: vi.fn(),
  },
}))

vi.mock('@/site.config', () => ({
  siteConfig: {
    env: {
      backendServiceURL: 'http://localhost:3000',
    },
  },
}))

/** Valid raw API response for health metrics */
function makeRawHealthResponse(): Record<string, unknown> {
  return {
    actions_completed: 4,
    actions_total: 10,
    linked_session_count: 3,
    health: 'NeedsAttention',
    last_session_date: '2026-03-08',
    next_action_due: null,
  }
}

describe('GoalHealthApi.get', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls getFn with the correct health endpoint URL', async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue(makeRawHealthResponse())

    await GoalHealthApi.get('goal-abc')

    expect(EntityApi.getFn).toHaveBeenCalledWith(
      'http://localhost:3000/goals/goal-abc/health'
    )
  })

  it('parses the raw response into GoalHealthMetrics with Option fields', async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue(makeRawHealthResponse())

    const result = await GoalHealthApi.get('goal-abc')

    expect(result.actions_completed).toBe(4)
    expect(result.actions_total).toBe(10)
    expect(result.linked_session_count).toBe(3)
    expect(result.health).toBe(GoalHealth.NeedsAttention)
    expect(result.last_session_date.some).toBe(true)
    expect(result.last_session_date.val).toBe('2026-03-08')
    expect(result.next_action_due.none).toBe(true)
  })

  it('throws when the backend returns invalid data', async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue({ bad: 'data' })

    await expect(GoalHealthApi.get('goal-abc')).rejects.toThrow(
      'Invalid GoalHealthMetrics data'
    )
  })
})

describe('useGoalHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes the correct URL to useEntity when goalId is Some', () => {
    vi.mocked(EntityApi.useEntity).mockReturnValue({
      entity: {
        actions_completed: 0,
        actions_total: 0,
        linked_session_count: 0,
        health: GoalHealth.SolidMomentum,
        last_session_date: { none: true, some: false } as any,
        next_action_due: { none: true, some: false } as any,
      },
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    })

    renderHook(() => useGoalHealth(Some('goal-xyz')))

    const [url] = vi.mocked(EntityApi.useEntity).mock.calls[0]
    expect(url).toBe('http://localhost:3000/goals/goal-xyz/health')
  })

  it('passes null URL to useEntity when goalId is None to skip fetching', () => {
    const { None } = require('ts-results')

    vi.mocked(EntityApi.useEntity).mockReturnValue({
      entity: {
        actions_completed: 0,
        actions_total: 0,
        linked_session_count: 0,
        health: GoalHealth.SolidMomentum,
        last_session_date: { none: true, some: false } as any,
        next_action_due: { none: true, some: false } as any,
      },
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    })

    renderHook(() => useGoalHealth(None))

    const [url] = vi.mocked(EntityApi.useEntity).mock.calls[0]
    expect(url).toBeNull()
  })

  it('returns healthMetrics from the hook', () => {
    const mockMetrics = {
      actions_completed: 5,
      actions_total: 10,
      linked_session_count: 2,
      health: GoalHealth.LetsRefocus,
      last_session_date: { some: true, none: false, val: '2026-03-01' } as any,
      next_action_due: { none: true, some: false } as any,
    }

    vi.mocked(EntityApi.useEntity).mockReturnValue({
      entity: mockMetrics,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    })

    const { result } = renderHook(() => useGoalHealth(Some('goal-123')))

    expect(result.current.healthMetrics).toBe(mockMetrics)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBeUndefined()
  })
})
