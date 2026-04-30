import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { DateTime } from 'ts-luxon'
import { ItemStatus } from '@/types/general'
import type { Goal, InProgressGoalSummary } from '@/types/goal'
import { useGoalFlow, GoalFlowStep } from '@/components/ui/coaching-sessions/goal-flow'

function makeGoal(id: string, overrides: Partial<Goal> = {}): Goal {
  const now = DateTime.now()
  return {
    id,
    coaching_relationship_id: 'rel-1',
    created_in_session_id: null,
    user_id: 'user-1',
    title: `Goal ${id}`,
    body: '',
    status: ItemStatus.InProgress,
    status_changed_at: now,
    completed_at: now,
    target_date: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

interface HarnessOptions {
  atLimit?: boolean
  allGoals?: Goal[]
  linkedGoalIds?: Set<string>
}

function setupFlow(options: HarnessOptions = {}) {
  const onLink = vi.fn()
  const onSwapAndLink = vi.fn()
  const onCreateAndLink = vi.fn()
  const onCreateAndSwap = vi.fn()
  const { result } = renderHook(() =>
    useGoalFlow({
      atLimit: options.atLimit ?? false,
      allGoals: options.allGoals ?? [],
      linkedGoalIds: options.linkedGoalIds ?? new Set(),
      onLink,
      onSwapAndLink,
      onCreateAndLink,
      onCreateAndSwap,
    })
  )
  return { result, onLink, onSwapAndLink, onCreateAndLink, onCreateAndSwap }
}

describe('useGoalFlow — proactive swap path (existing behavior)', () => {
  it('Add → atLimit → SelectingSwap → pick demote → Browsing(swapGoalId) → pick replacement → onSwapAndLink', () => {
    const linked = [makeGoal('g1'), makeGoal('g2'), makeGoal('g3')]
    const replacement = makeGoal('g4', { status: ItemStatus.OnHold })
    const { result, onSwapAndLink } = setupFlow({
      atLimit: true,
      allGoals: [...linked, replacement],
      linkedGoalIds: new Set(['g1', 'g2', 'g3']),
    })

    act(() => result.current.handleAddGoalClick())
    expect(result.current.flow.step).toBe(GoalFlowStep.SelectingSwap)
    // No override → display session-linked goals as candidates
    expect(result.current.swapCandidates.map((g) => g.id)).toEqual(['g1', 'g2', 'g3'])

    act(() => result.current.handleSwapSelected('g2'))
    expect(result.current.flow).toEqual({ step: GoalFlowStep.Browsing, swapGoalId: 'g2' })

    act(() => result.current.handleBrowseGoalClick('g4'))
    expect(onSwapAndLink).toHaveBeenCalledWith('g4', 'g2')
    expect(result.current.flow.step).toBe(GoalFlowStep.Idle)
  })

  it('Add → !atLimit → Browsing → pick existing → onLink', () => {
    const candidate = makeGoal('g4', { status: ItemStatus.OnHold })
    const { result, onLink, onSwapAndLink } = setupFlow({
      atLimit: false,
      allGoals: [candidate],
      linkedGoalIds: new Set(),
    })

    act(() => result.current.handleAddGoalClick())
    expect(result.current.flow.step).toBe(GoalFlowStep.Browsing)

    act(() => result.current.handleBrowseGoalClick('g4'))
    expect(onLink).toHaveBeenCalledWith('g4')
    expect(onSwapAndLink).not.toHaveBeenCalled()
    expect(result.current.flow.step).toBe(GoalFlowStep.Idle)
  })
})

describe('useGoalFlow — 409-recovery swap path (new behavior)', () => {
  it('enterSwapForLink seeds the dialog with BE-supplied candidates and resolves via onSwapAndLink', () => {
    // After clicking +Add for an OnHold goal "g4" the BE returns 409 with
    // its own InProgress list [g1, g2, g3]. enterSwapForLink should open
    // the swap dialog using those goals as candidates, and after the user
    // picks one, the flow should call onSwapAndLink('g4', <picked>).
    const inProgress = [
      makeGoal('g1'),
      makeGoal('g2'),
      makeGoal('g3'),
    ]
    const pendingGoal = makeGoal('g4', { status: ItemStatus.OnHold })

    const { result, onSwapAndLink, onLink } = setupFlow({
      atLimit: false,
      allGoals: [...inProgress, pendingGoal],
      linkedGoalIds: new Set(['g1']), // session has 1 linked, relationship has 3 InProgress
    })

    const candidates: InProgressGoalSummary[] = inProgress.map((g) => ({ id: g.id, title: g.title }))
    act(() => result.current.enterSwapForLink('g4', candidates))

    expect(result.current.flow.step).toBe(GoalFlowStep.SelectingSwap)
    expect(result.current.swapCandidates.map((g) => g.id)).toEqual(['g1', 'g2', 'g3'])

    act(() => result.current.handleSwapSelected('g2'))
    // Crucial: resolves via onSwapAndLink (NOT a transition to Browsing).
    expect(onSwapAndLink).toHaveBeenCalledWith('g4', 'g2')
    expect(onLink).not.toHaveBeenCalled()
    expect(result.current.flow.step).toBe(GoalFlowStep.Idle)
  })

  it('filters BE-supplied candidates that are missing from local allGoals', () => {
    // Stale FE state: BE says g1, g2, g3 are InProgress, but FE only has
    // g1 and g3 cached. Show what's resolvable; user picks from those.
    const allGoals = [makeGoal('g1'), makeGoal('g3'), makeGoal('g4', { status: ItemStatus.OnHold })]
    const { result } = setupFlow({ atLimit: false, allGoals, linkedGoalIds: new Set() })

    act(() =>
      result.current.enterSwapForLink('g4', [
        { id: 'g1', title: 'one' },
        { id: 'g2', title: 'two-but-stale' },
        { id: 'g3', title: 'three' },
      ])
    )
    expect(result.current.swapCandidates.map((g) => g.id)).toEqual(['g1', 'g3'])
  })

  it('handleCancel from 409-recovery returns to Idle without invoking either callback', () => {
    const { result, onLink, onSwapAndLink } = setupFlow({
      atLimit: false,
      allGoals: [makeGoal('g1')],
    })
    act(() =>
      result.current.enterSwapForLink('g4', [{ id: 'g1', title: 'one' }])
    )
    act(() => result.current.handleCancel())
    expect(result.current.flow.step).toBe(GoalFlowStep.Idle)
    expect(onLink).not.toHaveBeenCalled()
    expect(onSwapAndLink).not.toHaveBeenCalled()
  })
})
