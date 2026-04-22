import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Some, None } from '@/types/option'
import { GoalProgressApi, useGoalProgress } from '@/lib/api/goal-progress'
import { GoalProgress } from '@/types/goal-progress'
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

/** Valid raw API response for progress metrics (uses backend snake_case names) */
function makeRawProgressResponse(): Record<string, unknown> {
  return {
    actions_completed: 4,
    actions_total: 10,
    linked_coaching_session_count: 3,
    progress: 'NeedsAttention',
    last_coaching_session_date: '2026-03-08',
    next_action_due: null,
  }
}

describe('GoalProgressApi.get', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls getFn with the correct progress endpoint URL', async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue(makeRawProgressResponse())

    await GoalProgressApi.get('goal-abc')

    expect(EntityApi.getFn).toHaveBeenCalledWith(
      'http://localhost:3000/goals/goal-abc/progress'
    )
  })

  it('parses the raw response into GoalProgressMetrics with Option fields', async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue(makeRawProgressResponse())

    const result = await GoalProgressApi.get('goal-abc')

    expect(result.actions_completed).toBe(4)
    expect(result.actions_total).toBe(10)
    expect(result.linked_coaching_session_count).toBe(3)
    expect(result.progress).toBe(GoalProgress.NeedsAttention)
    expect(result.last_coaching_session_date.some).toBe(true)
    expect(result.last_coaching_session_date.val).toBe('2026-03-08')
    expect(result.next_action_due.none).toBe(true)
  })

  it('throws when the backend returns invalid data', async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue({ bad: 'data' })

    await expect(GoalProgressApi.get('goal-abc')).rejects.toThrow(
      'Invalid GoalProgressMetrics data'
    )
  })

  it('propagates network errors from EntityApi.getFn', async () => {
    vi.mocked(EntityApi.getFn).mockRejectedValue(new Error('Network failure'))

    await expect(GoalProgressApi.get('goal-abc')).rejects.toThrow(
      'Network failure'
    )
  })
})

describe('useGoalProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes the correct URL to useEntity when goalId is Some', () => {
    vi.mocked(EntityApi.useEntity).mockReturnValue({
      entity: {
        actions_completed: 0,
        actions_total: 0,
        linked_coaching_session_count: 0,
        progress: GoalProgress.SolidMomentum,
        last_coaching_session_date: None,
        next_action_due: None,
      },
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    })

    renderHook(() => useGoalProgress(Some('goal-xyz')))

    const [url] = vi.mocked(EntityApi.useEntity).mock.calls[0]
    expect(url).toBe('http://localhost:3000/goals/goal-xyz/progress')
  })

  it('passes null URL to useEntity when goalId is None to skip fetching', () => {
    vi.mocked(EntityApi.useEntity).mockReturnValue({
      entity: {
        actions_completed: 0,
        actions_total: 0,
        linked_coaching_session_count: 0,
        progress: GoalProgress.SolidMomentum,
        last_coaching_session_date: None,
        next_action_due: None,
      },
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    })

    renderHook(() => useGoalProgress(None))

    const [url] = vi.mocked(EntityApi.useEntity).mock.calls[0]
    expect(url).toBeNull()
  })

  it('returns progressMetrics from the hook', () => {
    const mockMetrics = {
      actions_completed: 5,
      actions_total: 10,
      linked_coaching_session_count: 2,
      progress: GoalProgress.LetsRefocus,
      last_coaching_session_date: Some('2026-03-01'),
      next_action_due: None,
    }

    vi.mocked(EntityApi.useEntity).mockReturnValue({
      entity: mockMetrics,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    })

    const { result } = renderHook(() => useGoalProgress(Some('goal-123')))

    expect(result.current.progressMetrics).toBe(mockMetrics)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBeUndefined()
  })
})
