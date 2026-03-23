import { describe, it, expect } from 'vitest'
import {
  GoalProgress,
  parseGoalProgressMetrics,
} from '@/types/goal-progress'

/** Factory for creating valid raw progress metrics matching the API response shape */
function makeProgressData(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    actions_completed: 3,
    actions_total: 8,
    linked_session_count: 5,
    progress: 'SolidMomentum',
    last_session_date: '2026-03-10',
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

  it('wraps null last_session_date as None', () => {
    const result = parseGoalProgressMetrics(makeProgressData({ last_session_date: null }))
    expect(result.last_session_date.none).toBe(true)
  })

  it('wraps null next_action_due as None', () => {
    const result = parseGoalProgressMetrics(makeProgressData({ next_action_due: null }))
    expect(result.next_action_due.none).toBe(true)
  })

  it('parses when both optional date fields are null', () => {
    const result = parseGoalProgressMetrics(
      makeProgressData({ last_session_date: null, next_action_due: null })
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

  it('throws when linked_session_count is a string instead of number', () => {
    expect(() =>
      parseGoalProgressMetrics(makeProgressData({ linked_session_count: '5' }))
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

  it('throws when last_session_date is a number instead of string or null', () => {
    expect(() =>
      parseGoalProgressMetrics(makeProgressData({ last_session_date: 123 }))
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
