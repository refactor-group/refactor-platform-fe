import { describe, it, expect } from 'vitest'
import { DateTime } from 'ts-luxon'
import { ItemStatus, EntityApiError } from '@/types/general'
import {
  isGoal,
  isGoalArray,
  parseGoal,
  defaultGoal,
  defaultGoals,
  getGoalById,
  goalToString,
  goalsToString,
  extractActiveGoalLimitError,
  isCannotLinkCompletedGoalError,
  isGoalAlreadyLinkedToSessionError,
} from '@/types/goal'
import type { Goal } from '@/types/goal'

function makeEntityApiError(status: number, data: unknown): EntityApiError {
  const axiosLikeError = Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { status, statusText: 'Error', data },
  })
  return new EntityApiError('POST', '/coaching_sessions/x/goals', axiosLikeError)
}

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

describe('extractActiveGoalLimitError', () => {
  // Wire format: ActiveGoalLimitConflict v1 contract on the coordination board.
  // 409 carries a generic `error: "conflict"` and the limit info under `details`.

  it('returns the limit info for the BE 409 conflict shape with details.in_progress_goals', () => {
    const err = makeEntityApiError(409, {
      status_code: 409,
      error: 'conflict',
      message: 'A coaching relationship can have at most 3 in-progress goals.',
      details: {
        max_in_progress_goals: 3,
        in_progress_goals: [
          { id: 'g1', title: 'Goal one' },
          { id: 'g2', title: 'Goal two' },
          { id: 'g3', title: 'Goal three' },
        ],
      },
    })

    const info = extractActiveGoalLimitError(err)
    expect(info).not.toBeNull()
    expect(info?.maxInProgressGoals).toBe(3)
    expect(info?.inProgressGoals).toHaveLength(3)
    expect(info?.inProgressGoals[0]).toEqual({ id: 'g1', title: 'Goal one' })
  })

  it('returns null for a 422 (wrong status)', () => {
    const err = makeEntityApiError(422, {
      details: { max_in_progress_goals: 3, in_progress_goals: [] },
    })
    expect(extractActiveGoalLimitError(err)).toBeNull()
  })

  it('returns null for a 409 without a details object', () => {
    const err = makeEntityApiError(409, { error: 'conflict', message: 'other' })
    expect(extractActiveGoalLimitError(err)).toBeNull()
  })

  it('returns null for a 409 with details missing max_in_progress_goals', () => {
    const err = makeEntityApiError(409, {
      error: 'conflict',
      details: { in_progress_goals: [] },
    })
    expect(extractActiveGoalLimitError(err)).toBeNull()
  })

  it('returns null for a 409 with details missing in_progress_goals array', () => {
    const err = makeEntityApiError(409, {
      error: 'conflict',
      details: { max_in_progress_goals: 3 },
    })
    expect(extractActiveGoalLimitError(err)).toBeNull()
  })

  it('returns null for the legacy active_goal_limit_reached top-level shape (no longer on the wire)', () => {
    // Documents the regression that existed pre-fix: the BE stopped sending
    // this shape on 2026-03-12. If a stub or older proxy ever surfaces it,
    // the parser must still return null so the UI surfaces an honest error
    // rather than a stale "limit reached" toast.
    const err = makeEntityApiError(409, {
      error: 'active_goal_limit_reached',
      max_active_goals: 3,
      active_goals: [{ id: 'g1', title: 'Goal one' }],
    })
    expect(extractActiveGoalLimitError(err)).toBeNull()
  })

  it('returns null for a non-EntityApiError input', () => {
    expect(extractActiveGoalLimitError(new Error('plain'))).toBeNull()
    expect(extractActiveGoalLimitError(null)).toBeNull()
    expect(extractActiveGoalLimitError(undefined)).toBeNull()
  })
})

describe('isCannotLinkCompletedGoalError', () => {
  it('returns true for a 422 cannot_link_completed_goal response', () => {
    const err = makeEntityApiError(422, {
      status_code: 422,
      error: 'cannot_link_completed_goal',
      message: 'This goal is completed',
    })
    expect(isCannotLinkCompletedGoalError(err)).toBe(true)
  })

  it('returns false for a 422 with a different error code', () => {
    const err = makeEntityApiError(422, { error: 'validation_failed' })
    expect(isCannotLinkCompletedGoalError(err)).toBe(false)
  })

  it('returns false for a 409 in-progress-goal-limit conflict response', () => {
    const err = makeEntityApiError(409, {
      error: 'conflict',
      details: { max_in_progress_goals: 3, in_progress_goals: [] },
    })
    expect(isCannotLinkCompletedGoalError(err)).toBe(false)
  })

  it('returns false for non-EntityApiError input', () => {
    expect(isCannotLinkCompletedGoalError(new Error('plain'))).toBe(false)
    expect(isCannotLinkCompletedGoalError(null)).toBe(false)
    expect(isCannotLinkCompletedGoalError(undefined)).toBe(false)
  })
})

describe('isGoalAlreadyLinkedToSessionError', () => {
  // Wire format: GoalAlreadyLinkedToSessionError v1 contract.
  // Specific top-level discriminator (no `details` envelope), distinct
  // from the cap-collision 409 which uses error: "conflict" + details.

  it('returns true for the BE 409 goal_already_linked_to_session shape', () => {
    const err = makeEntityApiError(409, {
      status_code: 409,
      error: 'goal_already_linked_to_session',
      message: 'This goal is already linked to the coaching session.',
    })
    expect(isGoalAlreadyLinkedToSessionError(err)).toBe(true)
  })

  it('returns false for the cap-collision 409 (different discriminator)', () => {
    const err = makeEntityApiError(409, {
      error: 'conflict',
      details: { max_in_progress_goals: 3, in_progress_goals: [] },
    })
    expect(isGoalAlreadyLinkedToSessionError(err)).toBe(false)
  })

  it('returns false for a 422 cannot_link_completed_goal response', () => {
    const err = makeEntityApiError(422, { error: 'cannot_link_completed_goal' })
    expect(isGoalAlreadyLinkedToSessionError(err)).toBe(false)
  })

  it('returns false for non-EntityApiError input', () => {
    expect(isGoalAlreadyLinkedToSessionError(new Error('plain'))).toBe(false)
    expect(isGoalAlreadyLinkedToSessionError(null)).toBe(false)
    expect(isGoalAlreadyLinkedToSessionError(undefined)).toBe(false)
  })
})

describe('link-endpoint error disambiguation', () => {
  // The link endpoint POST /coaching_sessions/:id/goals can emit two
  // structurally different 409s plus a structured 422. Each of the three
  // parsers must match exactly one shape and reject the others. This
  // test pins that mutual exclusion so future contract drift is caught
  // at FE-test-time, not user-rendering-time.

  const capCollision409 = {
    status_code: 409,
    error: 'conflict' as const,
    message: 'cap',
    details: { max_in_progress_goals: 3, in_progress_goals: [] },
  }
  const alreadyLinked409 = {
    status_code: 409,
    error: 'goal_already_linked_to_session' as const,
    message: 'dup',
  }
  const completed422 = {
    status_code: 422,
    error: 'cannot_link_completed_goal' as const,
    message: 'completed',
  }

  it('extractActiveGoalLimitError matches only the cap-collision 409', () => {
    expect(extractActiveGoalLimitError(makeEntityApiError(409, capCollision409))).not.toBeNull()
    expect(extractActiveGoalLimitError(makeEntityApiError(409, alreadyLinked409))).toBeNull()
    expect(extractActiveGoalLimitError(makeEntityApiError(422, completed422))).toBeNull()
  })

  it('isGoalAlreadyLinkedToSessionError matches only the duplicate-link 409', () => {
    expect(isGoalAlreadyLinkedToSessionError(makeEntityApiError(409, capCollision409))).toBe(false)
    expect(isGoalAlreadyLinkedToSessionError(makeEntityApiError(409, alreadyLinked409))).toBe(true)
    expect(isGoalAlreadyLinkedToSessionError(makeEntityApiError(422, completed422))).toBe(false)
  })

  it('isCannotLinkCompletedGoalError matches only the completed-goal 422', () => {
    expect(isCannotLinkCompletedGoalError(makeEntityApiError(409, capCollision409))).toBe(false)
    expect(isCannotLinkCompletedGoalError(makeEntityApiError(409, alreadyLinked409))).toBe(false)
    expect(isCannotLinkCompletedGoalError(makeEntityApiError(422, completed422))).toBe(true)
  })
})
