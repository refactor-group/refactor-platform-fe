import { describe, it, expect } from 'vitest'
import { DateTime } from 'ts-luxon'
import { ItemStatus } from '@/types/general'
import {
  isGoal,
  isGoalArray,
  parseGoal,
  defaultGoal,
  defaultGoals,
  getGoalById,
  goalToString,
  goalsToString,
} from '@/types/goal'
import type { Goal } from '@/types/goal'

/** Factory for creating test Goal data matching the PR2 schema */
function makeGoalData(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    id: 'goal-1',
    coaching_relationship_id: 'rel-1',
    created_in_session_id: 'session-1',
    user_id: 'user-1',
    title: 'Improve communication',
    body: 'Work on active listening',
    status: 'NotStarted',
    status_changed_at: '2026-03-01T00:00:00Z',
    completed_at: '2026-03-10T00:00:00Z',
    target_date: '2026-06-15',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

describe('isGoal', () => {
  it('returns true for a valid goal with all required fields', () => {
    expect(isGoal(makeGoalData())).toBe(true)
  })

  it('returns true when created_in_session_id is null', () => {
    expect(isGoal(makeGoalData({ created_in_session_id: null }))).toBe(true)
  })

  it('returns true when target_date is null', () => {
    expect(isGoal(makeGoalData({ target_date: null }))).toBe(true)
  })

  it('returns false for null', () => {
    expect(isGoal(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isGoal(undefined)).toBe(false)
  })

  it('returns false for a non-object', () => {
    expect(isGoal('not a goal')).toBe(false)
  })

  it('returns false when id is missing', () => {
    const { id: _, ...rest } = makeGoalData()
    expect(isGoal(rest)).toBe(false)
  })

  it('returns false when coaching_relationship_id is missing', () => {
    const { coaching_relationship_id: _, ...rest } = makeGoalData()
    expect(isGoal(rest)).toBe(false)
  })

  it('returns false when user_id is missing', () => {
    const { user_id: _, ...rest } = makeGoalData()
    expect(isGoal(rest)).toBe(false)
  })

  it('does not require the old coaching_session_id field', () => {
    // PR2 removed coaching_session_id — goals should validate without it
    const data = makeGoalData()
    expect(data).not.toHaveProperty('coaching_session_id')
    expect(isGoal(data)).toBe(true)
  })
})

describe('isGoalArray', () => {
  it('returns true for an array of valid goals', () => {
    expect(isGoalArray([makeGoalData(), makeGoalData({ id: 'goal-2' })])).toBe(true)
  })

  it('returns true for an empty array', () => {
    expect(isGoalArray([])).toBe(true)
  })

  it('returns false for a non-array', () => {
    expect(isGoalArray(makeGoalData())).toBe(false)
  })
})

describe('parseGoal', () => {
  it('parses valid goal data into a Goal object', () => {
    const data = makeGoalData()
    const goal = parseGoal(data)

    expect(goal.id).toBe('goal-1')
    expect(goal.coaching_relationship_id).toBe('rel-1')
    expect(goal.created_in_session_id).toBe('session-1')
    expect(goal.user_id).toBe('user-1')
    expect(goal.title).toBe('Improve communication')
    expect(goal.body).toBe('Work on active listening')
    expect(goal.status).toBe('NotStarted')
    expect(goal.target_date).toBe('2026-06-15')
  })

  it('parses goal with null created_in_session_id', () => {
    const goal = parseGoal(makeGoalData({ created_in_session_id: null }))
    expect(goal.created_in_session_id).toBeNull()
  })

  it('parses goal with null target_date', () => {
    const goal = parseGoal(makeGoalData({ target_date: null }))
    expect(goal.target_date).toBeNull()
  })

  it('throws on invalid data', () => {
    expect(() => parseGoal({ id: 123 })).toThrow()
  })
})

describe('defaultGoal', () => {
  it('returns a goal with the PR2 field shape', () => {
    const goal = defaultGoal()

    expect(goal).toHaveProperty('id')
    expect(goal).toHaveProperty('coaching_relationship_id')
    expect(goal).toHaveProperty('created_in_session_id')
    expect(goal).toHaveProperty('target_date')
    expect(goal).toHaveProperty('user_id')
    expect(goal).toHaveProperty('title')
    expect(goal).toHaveProperty('body')
    expect(goal).toHaveProperty('status')
  })

  it('does not have the old coaching_session_id field', () => {
    const goal = defaultGoal()
    expect(goal).not.toHaveProperty('coaching_session_id')
  })

  it('has null for nullable fields', () => {
    const goal = defaultGoal()
    expect(goal.created_in_session_id).toBeNull()
    expect(goal.target_date).toBeNull()
  })

  it('has NotStarted status', () => {
    const goal = defaultGoal()
    expect(goal.status).toBe(ItemStatus.NotStarted)
  })
})

describe('defaultGoals', () => {
  it('returns an array with one default goal', () => {
    const goals = defaultGoals()
    expect(goals).toHaveLength(1)
    expect(goals[0]).toHaveProperty('coaching_relationship_id')
  })
})

describe('getGoalById', () => {
  it('returns the matching goal', () => {
    const now = DateTime.now()
    const goals: Goal[] = [
      { ...defaultGoal(), id: 'a', coaching_relationship_id: 'rel-1', created_at: now, updated_at: now },
      { ...defaultGoal(), id: 'b', coaching_relationship_id: 'rel-1', created_at: now, updated_at: now },
    ]
    expect(getGoalById('b', goals).id).toBe('b')
  })

  it('returns a default goal when not found', () => {
    const goal = getGoalById('nonexistent', [])
    expect(goal.id).toBe('')
    expect(goal).toHaveProperty('coaching_relationship_id')
  })
})

describe('goalToString / goalsToString', () => {
  it('serializes a goal to JSON', () => {
    const goal = defaultGoal()
    const json = goalToString(goal)
    expect(json).toContain('coaching_relationship_id')
    expect(json).not.toContain('coaching_session_id')
  })

  it('serializes undefined to "undefined"', () => {
    expect(goalToString(undefined)).toBe(undefined)
  })

  it('serializes a goal array to JSON', () => {
    const json = goalsToString([defaultGoal()])
    expect(json).toContain('coaching_relationship_id')
  })
})
