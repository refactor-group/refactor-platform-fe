import { describe, it, expect } from 'vitest'
import {
  GoalHealth,
  isGoalHealthMetricsRaw,
  parseGoalHealthMetrics,
} from '@/types/goal-health'

/** Factory for creating valid raw health metrics matching the API response shape */
function makeHealthData(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    actions_completed: 3,
    actions_total: 8,
    linked_session_count: 5,
    health: 'SolidMomentum',
    last_session_date: '2026-03-10',
    next_action_due: '2026-03-15T09:00:00Z',
    ...overrides,
  }
}

describe('GoalHealth enum', () => {
  it('has exactly three values', () => {
    const values = Object.values(GoalHealth)
    expect(values).toHaveLength(3)
    expect(values).toContain('SolidMomentum')
    expect(values).toContain('NeedsAttention')
    expect(values).toContain('LetsRefocus')
  })
})

describe('isGoalHealthMetricsRaw', () => {
  it('returns true for valid data with all fields present', () => {
    expect(isGoalHealthMetricsRaw(makeHealthData())).toBe(true)
  })

  it('returns true when last_session_date is null', () => {
    expect(isGoalHealthMetricsRaw(makeHealthData({ last_session_date: null }))).toBe(true)
  })

  it('returns true when next_action_due is null', () => {
    expect(isGoalHealthMetricsRaw(makeHealthData({ next_action_due: null }))).toBe(true)
  })

  it('returns true when both optional date fields are null', () => {
    expect(
      isGoalHealthMetricsRaw(makeHealthData({ last_session_date: null, next_action_due: null }))
    ).toBe(true)
  })

  it('accepts all GoalHealth enum values', () => {
    for (const health of Object.values(GoalHealth)) {
      expect(isGoalHealthMetricsRaw(makeHealthData({ health }))).toBe(true)
    }
  })

  it('rejects null', () => {
    expect(isGoalHealthMetricsRaw(null)).toBe(false)
  })

  it('rejects undefined', () => {
    expect(isGoalHealthMetricsRaw(undefined)).toBe(false)
  })

  it('rejects a non-object', () => {
    expect(isGoalHealthMetricsRaw('not metrics')).toBe(false)
  })

  it('rejects when actions_completed is a string instead of number', () => {
    expect(isGoalHealthMetricsRaw(makeHealthData({ actions_completed: '3' }))).toBe(false)
  })

  it('rejects when actions_total is a string instead of number', () => {
    expect(isGoalHealthMetricsRaw(makeHealthData({ actions_total: '8' }))).toBe(false)
  })

  it('rejects when linked_session_count is a string instead of number', () => {
    expect(isGoalHealthMetricsRaw(makeHealthData({ linked_session_count: '5' }))).toBe(false)
  })

  it('rejects an invalid health enum value', () => {
    expect(isGoalHealthMetricsRaw(makeHealthData({ health: 'InvalidHealth' }))).toBe(false)
  })

  it('rejects when health is a number instead of string', () => {
    expect(isGoalHealthMetricsRaw(makeHealthData({ health: 42 }))).toBe(false)
  })

  it('rejects when last_session_date is a number instead of string or null', () => {
    expect(isGoalHealthMetricsRaw(makeHealthData({ last_session_date: 123 }))).toBe(false)
  })

  it('rejects when next_action_due is a boolean instead of string or null', () => {
    expect(isGoalHealthMetricsRaw(makeHealthData({ next_action_due: true }))).toBe(false)
  })

  it('rejects when a required numeric field is missing', () => {
    const data = makeHealthData()
    delete data.actions_completed
    expect(isGoalHealthMetricsRaw(data)).toBe(false)
  })

  it('rejects when health field is missing', () => {
    const data = makeHealthData()
    delete data.health
    expect(isGoalHealthMetricsRaw(data)).toBe(false)
  })
})

describe('parseGoalHealthMetrics', () => {
  it('parses valid data and wraps present dates in Some', () => {
    const result = parseGoalHealthMetrics(makeHealthData())

    expect(result.actions_completed).toBe(3)
    expect(result.actions_total).toBe(8)
    expect(result.linked_session_count).toBe(5)
    expect(result.health).toBe(GoalHealth.SolidMomentum)

    expect(result.last_session_date.some).toBe(true)
    expect(result.last_session_date.val).toBe('2026-03-10')

    expect(result.next_action_due.some).toBe(true)
    expect(result.next_action_due.val).toBe('2026-03-15T09:00:00Z')
  })

  it('wraps null last_session_date as None', () => {
    const result = parseGoalHealthMetrics(makeHealthData({ last_session_date: null }))
    expect(result.last_session_date.none).toBe(true)
  })

  it('wraps null next_action_due as None', () => {
    const result = parseGoalHealthMetrics(makeHealthData({ next_action_due: null }))
    expect(result.next_action_due.none).toBe(true)
  })

  it('correctly maps each GoalHealth enum variant', () => {
    for (const health of Object.values(GoalHealth)) {
      const result = parseGoalHealthMetrics(makeHealthData({ health }))
      expect(result.health).toBe(health)
    }
  })

  it('throws on null input', () => {
    expect(() => parseGoalHealthMetrics(null)).toThrow('Invalid GoalHealthMetrics data')
  })

  it('throws on undefined input', () => {
    expect(() => parseGoalHealthMetrics(undefined)).toThrow('Invalid GoalHealthMetrics data')
  })

  it('throws when health is an invalid enum value', () => {
    expect(() => parseGoalHealthMetrics(makeHealthData({ health: 'Bad' }))).toThrow(
      'Invalid GoalHealthMetrics data'
    )
  })

  it('throws when a numeric field has the wrong type', () => {
    expect(() =>
      parseGoalHealthMetrics(makeHealthData({ actions_total: 'not a number' }))
    ).toThrow('Invalid GoalHealthMetrics data')
  })
})
