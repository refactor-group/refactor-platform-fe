import { describe, it, expect } from 'vitest'
import {
  GoalProgress,
  parseGoalProgressMetrics,
  parseGoalProgressResponse,
} from '@/types/goal-progress'

/** Factory for creating valid raw progress metrics matching the API response shape */
function makeProgressData(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    actions_completed: 3,
    actions_total: 8,
    linked_coaching_session_count: 5,
    progress: 'SolidMomentum',
    last_coaching_session_date: '2026-03-10',
    next_action_due: '2026-03-15T09:00:00Z',
    ...overrides,
  }
}

describe('GoalProgress enum', () => {
  it('has exactly three values', () => {
    const values = Object.values(GoalProgress)
    expect(values).toHaveLength(3)
    expect(values).toContain('SolidMomentum')
    expect(values).toContain('NeedsAttention')
    expect(values).toContain('LetsRefocus')
  })
})

describe('parseGoalProgressMetrics', () => {
  // ── Valid input ──────────────────────────────────────────────────

  it('parses valid data and wraps present dates in Some', () => {
    const result = parseGoalProgressMetrics(makeProgressData())

    expect(result.actions_completed).toBe(3)
    expect(result.actions_total).toBe(8)
    expect(result.linked_session_count).toBe(5)
    expect(result.progress).toBe(GoalProgress.SolidMomentum)

    expect(result.last_session_date.some).toBe(true)
    expect(result.last_session_date.val).toBe('2026-03-10')

    expect(result.next_action_due.some).toBe(true)
    expect(result.next_action_due.val).toBe('2026-03-15T09:00:00Z')
  })

  it('wraps null last_coaching_session_date as None', () => {
    const result = parseGoalProgressMetrics(makeProgressData({ last_coaching_session_date: null }))
    expect(result.last_session_date.none).toBe(true)
  })

  it('wraps null next_action_due as None', () => {
    const result = parseGoalProgressMetrics(makeProgressData({ next_action_due: null }))
    expect(result.next_action_due.none).toBe(true)
  })

  it('parses when both optional date fields are null', () => {
    const result = parseGoalProgressMetrics(
      makeProgressData({ last_coaching_session_date: null, next_action_due: null })
    )
    expect(result.last_session_date.none).toBe(true)
    expect(result.next_action_due.none).toBe(true)
  })

  it('correctly maps each GoalProgress enum variant', () => {
    for (const progress of Object.values(GoalProgress)) {
      const result = parseGoalProgressMetrics(makeProgressData({ progress }))
      expect(result.progress).toBe(progress)
    }
  })

  // ── Invalid input — non-objects ──────────────────────────────────

  it('throws on null input', () => {
    expect(() => parseGoalProgressMetrics(null)).toThrow('Invalid GoalProgressMetrics data')
  })

  it('throws on undefined input', () => {
    expect(() => parseGoalProgressMetrics(undefined)).toThrow('Invalid GoalProgressMetrics data')
  })

  it('throws on a non-object', () => {
    expect(() => parseGoalProgressMetrics('not metrics')).toThrow('Invalid GoalProgressMetrics data')
  })

  // ── Invalid input — wrong field types ────────────────────────────

  it('throws when actions_completed is a string instead of number', () => {
    expect(() =>
      parseGoalProgressMetrics(makeProgressData({ actions_completed: '3' }))
    ).toThrow('Invalid GoalProgressMetrics data')
  })

  it('throws when actions_total is a string instead of number', () => {
    expect(() =>
      parseGoalProgressMetrics(makeProgressData({ actions_total: '8' }))
    ).toThrow('Invalid GoalProgressMetrics data')
  })

  it('throws when linked_coaching_session_count is a string instead of number', () => {
    expect(() =>
      parseGoalProgressMetrics(makeProgressData({ linked_coaching_session_count: '5' }))
    ).toThrow('Invalid GoalProgressMetrics data')
  })

  it('throws when progress is an invalid enum value', () => {
    expect(() =>
      parseGoalProgressMetrics(makeProgressData({ progress: 'InvalidProgress' }))
    ).toThrow('Invalid GoalProgressMetrics data')
  })

  it('throws when progress is a number instead of string', () => {
    expect(() =>
      parseGoalProgressMetrics(makeProgressData({ progress: 42 }))
    ).toThrow('Invalid GoalProgressMetrics data')
  })

  it('throws when last_coaching_session_date is a number instead of string or null', () => {
    expect(() =>
      parseGoalProgressMetrics(makeProgressData({ last_coaching_session_date: 123 }))
    ).toThrow('Invalid GoalProgressMetrics data')
  })

  it('throws when next_action_due is a boolean instead of string or null', () => {
    expect(() =>
      parseGoalProgressMetrics(makeProgressData({ next_action_due: true }))
    ).toThrow('Invalid GoalProgressMetrics data')
  })

  // ── Invalid input — missing fields ───────────────────────────────

  it('throws when a required numeric field is missing', () => {
    const data = makeProgressData()
    delete data.actions_completed
    expect(() => parseGoalProgressMetrics(data)).toThrow('Invalid GoalProgressMetrics data')
  })

  it('throws when progress field is missing', () => {
    const data = makeProgressData()
    delete data.progress
    expect(() => parseGoalProgressMetrics(data)).toThrow('Invalid GoalProgressMetrics data')
  })
})

// ── Aggregate GoalWithProgress parsing ────────────────────────────────

function makeGoalWithProgressData(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    goal_id: 'goal-1',
    coaching_relationship_id: 'rel-1',
    title: 'Test goal',
    body: 'Test body',
    status: 'InProgress',
    status_changed_at: '2026-02-01T00:00:00Z',
    target_date: '2026-06-01',
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-02-20T00:00:00Z',
    progress_metrics: makeProgressData(),
    ...overrides,
  }
}

describe('parseGoalProgressResponse', () => {
  it('parses a valid response with one goal', () => {
    const response = { goal_progress: [makeGoalWithProgressData()] }
    const result = parseGoalProgressResponse(response)

    expect(result).toHaveLength(1)
    expect(result[0].goal_id).toBe('goal-1')
    expect(result[0].coaching_relationship_id).toBe('rel-1')
    expect(result[0].title).toBe('Test goal')
    expect(result[0].body).toBe('Test body')
    expect(result[0].status).toBe('InProgress')
    expect(result[0].target_date).toBe('2026-06-01')
    expect(result[0].created_at).toBe('2026-01-15T00:00:00Z')
    expect(result[0].updated_at).toBe('2026-02-20T00:00:00Z')
    expect(result[0].progress_metrics.actions_completed).toBe(3)
    expect(result[0].progress_metrics.actions_total).toBe(8)
    expect(result[0].progress_metrics.progress).toBe(GoalProgress.SolidMomentum)
  })

  it('parses a response with multiple goals', () => {
    const response = {
      goal_progress: [
        makeGoalWithProgressData({ goal_id: 'g1', title: 'Goal A' }),
        makeGoalWithProgressData({ goal_id: 'g2', title: 'Goal B' }),
      ],
    }
    const result = parseGoalProgressResponse(response)
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('Goal A')
    expect(result[1].title).toBe('Goal B')
  })

  it('parses a response with an empty array', () => {
    const result = parseGoalProgressResponse({ goal_progress: [] })
    expect(result).toHaveLength(0)
  })

  it('handles null target_date correctly', () => {
    const response = {
      goal_progress: [makeGoalWithProgressData({ target_date: null })],
    }
    const result = parseGoalProgressResponse(response)
    expect(result[0].target_date).toBeNull()
  })

  it('throws on null input', () => {
    expect(() => parseGoalProgressResponse(null)).toThrow('Invalid GoalProgressResponse data')
  })

  it('throws on undefined input', () => {
    expect(() => parseGoalProgressResponse(undefined)).toThrow('Invalid GoalProgressResponse data')
  })

  it('throws when goal_progress is not an array', () => {
    expect(() => parseGoalProgressResponse({ goal_progress: 'not array' })).toThrow(
      'Invalid GoalProgressResponse data'
    )
  })

  it('throws when goal_progress key is missing', () => {
    expect(() => parseGoalProgressResponse({ other_key: [] })).toThrow(
      'Invalid GoalProgressResponse data'
    )
  })

  it('throws when a goal entry has invalid progress_metrics', () => {
    expect(() =>
      parseGoalProgressResponse({
        goal_progress: [makeGoalWithProgressData({ progress_metrics: { bad: true } })],
      })
    ).toThrow('Invalid GoalProgressMetrics data')
  })

  it('throws when a goal entry is missing required fields', () => {
    const badGoal = makeGoalWithProgressData()
    delete badGoal.title
    expect(() =>
      parseGoalProgressResponse({ goal_progress: [badGoal] })
    ).toThrow('Invalid GoalWithProgress data')
  })
})
