import { describe, it, expect } from 'vitest'
import { sortActionArray } from '@/types/action'
import { SortOrder } from '@/types/sorting'
import { ItemStatus } from '@/types/general'
import { DateTime } from 'ts-luxon'
import type { Action } from '@/types/action'

const makeAction = (id: string, createdAt: string, updatedAt: string): Action => ({
  id,
  coaching_session_id: 'session-1',
  user_id: 'user-1',
  body: `Action ${id}`,
  status: ItemStatus.NotStarted,
  status_changed_at: DateTime.now(),
  due_by: DateTime.now(),
  created_at: DateTime.fromISO(createdAt),
  updated_at: DateTime.fromISO(updatedAt),
  assignee_ids: [],
})

describe('sortActionArray', () => {
  const actions = [
    makeAction('b', '2026-02-02', '2026-02-10'),
    makeAction('a', '2026-02-01', '2026-02-12'),
    makeAction('c', '2026-02-03', '2026-02-08'),
  ]

  it('sorts by created_at ascending', () => {
    const sorted = sortActionArray(actions, SortOrder.Asc, 'created_at')
    expect(sorted.map((a) => a.id)).toEqual(['a', 'b', 'c'])
  })

  it('sorts by created_at descending', () => {
    const sorted = sortActionArray(actions, SortOrder.Desc, 'created_at')
    expect(sorted.map((a) => a.id)).toEqual(['c', 'b', 'a'])
  })

  it('sorts by updated_at ascending', () => {
    const sorted = sortActionArray(actions, SortOrder.Asc, 'updated_at')
    expect(sorted.map((a) => a.id)).toEqual(['c', 'b', 'a'])
  })

  it('sorts by updated_at descending', () => {
    const sorted = sortActionArray(actions, SortOrder.Desc, 'updated_at')
    expect(sorted.map((a) => a.id)).toEqual(['a', 'b', 'c'])
  })

  it('defaults to updated_at when no field specified', () => {
    const sorted = sortActionArray(actions, SortOrder.Asc)
    expect(sorted.map((a) => a.id)).toEqual(['c', 'b', 'a'])
  })

  it('does not mutate the original array', () => {
    const original = [...actions]
    sortActionArray(actions, SortOrder.Asc, 'created_at')
    expect(actions.map((a) => a.id)).toEqual(original.map((a) => a.id))
  })

  describe('deterministic tiebreaker', () => {
    it('should produce stable order when primary sort field values are equal', () => {
      const sameDueBy = DateTime.fromISO('2026-02-10')
      const tiedActions = [
        { ...makeAction('zzz', '2026-02-01', '2026-02-10'), due_by: sameDueBy },
        { ...makeAction('aaa', '2026-02-01', '2026-02-10'), due_by: sameDueBy },
        { ...makeAction('mmm', '2026-02-01', '2026-02-10'), due_by: sameDueBy },
      ]

      const sorted = sortActionArray(tiedActions, SortOrder.Desc, 'due_by')
      // Primary field is equal for all; tiebreaker sorts ascending by id
      expect(sorted.map((a) => a.id)).toEqual(['aaa', 'mmm', 'zzz'])
    })

    it('should maintain primary sort order when values differ', () => {
      const distinctActions = [
        { ...makeAction('b', '2026-02-02', '2026-02-10'), due_by: DateTime.fromISO('2026-02-05') },
        { ...makeAction('a', '2026-02-01', '2026-02-12'), due_by: DateTime.fromISO('2026-02-10') },
        { ...makeAction('c', '2026-02-03', '2026-02-08'), due_by: DateTime.fromISO('2026-02-01') },
      ]

      const sorted = sortActionArray(distinctActions, SortOrder.Desc, 'due_by')
      expect(sorted.map((a) => a.id)).toEqual(['a', 'b', 'c'])
    })

    it('should be idempotent — sorting twice yields the same order', () => {
      const sameDueBy = DateTime.fromISO('2026-02-10')
      const tiedActions = [
        { ...makeAction('c', '2026-02-01', '2026-02-10'), due_by: sameDueBy },
        { ...makeAction('a', '2026-02-01', '2026-02-10'), due_by: sameDueBy },
        { ...makeAction('b', '2026-02-01', '2026-02-10'), due_by: sameDueBy },
      ]

      const first = sortActionArray(tiedActions, SortOrder.Asc, 'due_by')
      const second = sortActionArray(first, SortOrder.Asc, 'due_by')
      expect(first.map((a) => a.id)).toEqual(second.map((a) => a.id))
    })
  })
})
