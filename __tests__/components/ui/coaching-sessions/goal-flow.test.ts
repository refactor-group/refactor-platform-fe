import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { DateTime } from 'ts-luxon'
import { ItemStatus } from '@/types/general'
import type { Goal, InProgressGoalSummary } from '@/types/goal'
import {
  useGoalFlow,
  GoalFlowStep,
  type LinkAttemptResult,
} from '@/components/ui/coaching-sessions/goal-flow'

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
  onLinkResult?: LinkAttemptResult
}

function setupFlow(options: HarnessOptions = {}) {
  const onLink = vi.fn(async (_goalId: string): Promise<LinkAttemptResult> => {
    return options.onLinkResult ?? { kind: 'done' }
  })
  const onSwapAndLink = vi.fn()
  const onCreateAndLink = vi.fn()
  const onCreateAndSwap = vi.fn()
  const onRefreshGoals = vi.fn()
  const { result } = renderHook(() =>
    useGoalFlow({
      atLimit: options.atLimit ?? false,
      allGoals: options.allGoals ?? [],
      linkedGoalIds: options.linkedGoalIds ?? new Set(),
      onLink,
      onSwapAndLink,
      onCreateAndLink,
      onCreateAndSwap,
      onRefreshGoals,
    })
  )
  return { result, onLink, onSwapAndLink, onCreateAndLink, onCreateAndSwap, onRefreshGoals }
}

describe('useGoalFlow — proactive swap path (existing behavior)', () => {
  it('Add → atLimit → SelectingSwap → pick demote → Browsing(swapGoalId) → pick replacement → onSwapAndLink', async () => {
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

    await act(async () => { await result.current.handleBrowseGoalClick('g4') })
    expect(onSwapAndLink).toHaveBeenCalledWith('g4', 'g2')
    expect(result.current.flow.step).toBe(GoalFlowStep.Idle)
  })

  it('Add → !atLimit → Browsing → pick existing → onLink', async () => {
    const candidate = makeGoal('g4', { status: ItemStatus.OnHold })
    const { result, onLink, onSwapAndLink } = setupFlow({
      atLimit: false,
      allGoals: [candidate],
      linkedGoalIds: new Set(),
    })

    act(() => result.current.handleAddGoalClick())
    expect(result.current.flow.step).toBe(GoalFlowStep.Browsing)

    await act(async () => { await result.current.handleBrowseGoalClick('g4') })
    expect(onLink).toHaveBeenCalledWith('g4')
    expect(onSwapAndLink).not.toHaveBeenCalled()
    expect(result.current.flow.step).toBe(GoalFlowStep.Idle)
  })
})

describe('useGoalFlow — 409-recovery swap path (new behavior)', () => {
  it('onLink returning needs-swap-recovery transitions to SelectingSwap and resolves via onSwapAndLink', async () => {
    // The user clicks an OnHold goal "g4" in the browse view. The panel's
    // handleLink hits the BE, gets a 409, and returns
    // { kind: "needs-swap-recovery", candidates: [g1,g2,g3] }. The hook
    // should transition to SelectingSwap with those candidates, and after
    // the user picks one, resolve via onSwapAndLink('g4', <picked>).
    const inProgress = [
      makeGoal('g1'),
      makeGoal('g2'),
      makeGoal('g3'),
    ]
    const pendingGoal = makeGoal('g4', { status: ItemStatus.OnHold })
    const candidates: InProgressGoalSummary[] = inProgress.map((g) => ({ id: g.id, title: g.title }))

    const { result, onSwapAndLink, onLink, onRefreshGoals } = setupFlow({
      atLimit: false,
      allGoals: [...inProgress, pendingGoal],
      linkedGoalIds: new Set(['g1']),
      onLinkResult: { kind: 'needs-swap-recovery', candidates },
    })

    act(() => result.current.handleAddGoalClick())
    expect(result.current.flow.step).toBe(GoalFlowStep.Browsing)

    await act(async () => { await result.current.handleBrowseGoalClick('g4') })

    expect(onLink).toHaveBeenCalledWith('g4')
    expect(result.current.flow.step).toBe(GoalFlowStep.SelectingSwap)
    expect(result.current.swapCandidates.map((g) => g.id)).toEqual(['g1', 'g2', 'g3'])
    // FE just learned its view is stale; refresh fires unconditionally on
    // entry to 409-recovery so candidates resolve as the cache repopulates.
    expect(onRefreshGoals).toHaveBeenCalledTimes(1)

    act(() => result.current.handleSwapSelected('g2'))
    // Crucial: resolves via onSwapAndLink (NOT a transition to Browsing).
    expect(onSwapAndLink).toHaveBeenCalledWith('g4', 'g2')
    expect(result.current.flow.step).toBe(GoalFlowStep.Idle)
  })

  it('filters BE-supplied candidates that are missing from local allGoals (refresh repopulates them)', async () => {
    // Stale FE state: BE says g1, g2, g3 are InProgress, but FE only has
    // g1 and g3 cached. swapCandidates filters to what's resolvable for
    // the moment; the auto-refresh fired on entry will repopulate.
    const allGoals = [makeGoal('g1'), makeGoal('g3'), makeGoal('g4', { status: ItemStatus.OnHold })]
    const { result, onRefreshGoals } = setupFlow({
      atLimit: false,
      allGoals,
      linkedGoalIds: new Set(),
      onLinkResult: {
        kind: 'needs-swap-recovery',
        candidates: [
          { id: 'g1', title: 'one' },
          { id: 'g2', title: 'two-but-stale' },
          { id: 'g3', title: 'three' },
        ],
      },
    })

    act(() => result.current.handleAddGoalClick())
    await act(async () => { await result.current.handleBrowseGoalClick('g4') })

    expect(result.current.swapCandidates.map((g) => g.id)).toEqual(['g1', 'g3'])
    expect(onRefreshGoals).toHaveBeenCalledTimes(1)
  })

  it('handleCancel from 409-recovery returns to Idle without invoking onSwapAndLink', async () => {
    const { result, onSwapAndLink } = setupFlow({
      atLimit: false,
      allGoals: [makeGoal('g1'), makeGoal('g4', { status: ItemStatus.OnHold })],
      onLinkResult: {
        kind: 'needs-swap-recovery',
        candidates: [{ id: 'g1', title: 'one' }],
      },
    })

    act(() => result.current.handleAddGoalClick())
    await act(async () => { await result.current.handleBrowseGoalClick('g4') })
    expect(result.current.flow.step).toBe(GoalFlowStep.SelectingSwap)

    act(() => result.current.handleCancel())
    expect(result.current.flow.step).toBe(GoalFlowStep.Idle)
    expect(onSwapAndLink).not.toHaveBeenCalled()
  })
})
