import { useState, useCallback, useMemo } from "react";
import type { Goal, InProgressGoalSummary } from "@/types/goal";
import { ItemStatus } from "@/types/general";

// ── Goal Flow State Machine ────────────────────────────────────────────

export enum GoalFlowStep {
  Idle = "idle",
  SelectingSwap = "selecting-swap",
  Browsing = "browsing",
  Creating = "creating",
}

export type GoalFlowState =
  | { step: GoalFlowStep.Idle }
  | {
      step: GoalFlowStep.SelectingSwap;
      // When set, the user already picked the goal to link (via Browsing)
      // and the BE rejected with 409. After they pick a demote candidate,
      // resolve via onSwapAndLink(pendingLinkGoalId, demoteId) instead of
      // re-entering Browsing.
      pendingLinkGoalId?: string;
      // BE-supplied list of currently-InProgress goals from the 409 body.
      // Authoritative; preferred over the FE's view of session-linked goals
      // when the cap was hit on the relationship (not the session).
      candidateOverrides?: InProgressGoalSummary[];
    }
  | { step: GoalFlowStep.Browsing; swapGoalId?: string }
  | { step: GoalFlowStep.Creating; swapGoalId?: string };

interface GoalFlowCallbacks {
  atLimit: boolean;
  allGoals: Goal[];
  linkedGoalIds: Set<string>;
  onLink: (goalId: string) => void;
  onSwapAndLink: (newGoalId: string, swapGoalId: string) => void;
  onCreateAndLink: (title: string, body?: string) => void;
  onCreateAndSwap: (title: string, swapGoalId: string, body?: string) => void;
}

export enum SlideDirection {
  Forward = "forward",
  Backward = "backward",
}

export function useGoalFlow({
  atLimit,
  allGoals,
  linkedGoalIds,
  onLink,
  onSwapAndLink,
  onCreateAndLink,
  onCreateAndSwap,
}: GoalFlowCallbacks) {
  const [flow, setFlow] = useState<GoalFlowState>({ step: GoalFlowStep.Idle });
  const [direction, setDirection] = useState<SlideDirection>(SlideDirection.Forward);

  const availableGoals = useMemo(
    () =>
      allGoals
        .filter(
          (g) =>
            !linkedGoalIds.has(g.id) &&
            g.status !== ItemStatus.Completed &&
            g.status !== ItemStatus.WontDo
        )
        .sort(
          (a, b) =>
            new Date(String(b.created_at)).getTime() -
            new Date(String(a.created_at)).getTime()
        ),
    [allGoals, linkedGoalIds]
  );

  const handleAddGoalClick = useCallback(() => {
    setDirection(SlideDirection.Forward);
    if (atLimit) {
      setFlow({ step: GoalFlowStep.SelectingSwap });
    } else {
      setFlow({ step: GoalFlowStep.Browsing });
    }
  }, [atLimit]);

  const handleSwapSelected = useCallback(
    (goalId: string) => {
      setDirection(SlideDirection.Forward);
      // 409-recovery path: user already chose what to link; just resolve
      // the swap and exit. Otherwise fall through to the "+Add → at limit"
      // path which transitions to Browsing for the user to pick the new goal.
      if (flow.step === GoalFlowStep.SelectingSwap && flow.pendingLinkGoalId) {
        onSwapAndLink(flow.pendingLinkGoalId, goalId);
        setFlow({ step: GoalFlowStep.Idle });
        return;
      }
      setFlow({ step: GoalFlowStep.Browsing, swapGoalId: goalId });
    },
    [flow, onSwapAndLink]
  );

  /**
   * Open the swap dialog programmatically in response to a 409 from the
   * link endpoint. The user has already picked `goalId`; after they pick
   * a demote candidate, the flow resolves via onSwapAndLink rather than
   * re-entering Browsing. `candidates` is the BE-supplied authoritative
   * list of currently-InProgress goals (from `details.in_progress_goals`).
   */
  const enterSwapForLink = useCallback(
    (goalId: string, candidates: InProgressGoalSummary[]) => {
      setDirection(SlideDirection.Forward);
      setFlow({
        step: GoalFlowStep.SelectingSwap,
        pendingLinkGoalId: goalId,
        candidateOverrides: candidates,
      });
    },
    []
  );

  /**
   * Resolved swap-candidate Goal[] for the SelectingSwap UI.
   * - When `candidateOverrides` is set (entered via 409), look up each id
   *   in `allGoals`. If a candidate isn't in local state (rare cache lag),
   *   it's filtered out — the user picks from what's resolvable, and the
   *   subsequent demote update_status call would otherwise fail anyway.
   * - Otherwise, the dialog was opened proactively from "+Add → at limit";
   *   show the session-linked goals (which under the new invariant are all
   *   InProgress).
   */
  const swapCandidates = useMemo<Goal[]>(() => {
    if (flow.step !== GoalFlowStep.SelectingSwap) return [];
    if (flow.candidateOverrides) {
      return flow.candidateOverrides
        .map(({ id }) => allGoals.find((g) => g.id === id))
        .filter((g): g is Goal => g !== undefined);
    }
    return allGoals.filter((g) => linkedGoalIds.has(g.id));
  }, [flow, allGoals, linkedGoalIds]);

  const handleBrowseGoalClick = useCallback(
    (goalId: string) => {
      setDirection(SlideDirection.Backward);
      if (flow.step === GoalFlowStep.Browsing && flow.swapGoalId) {
        onSwapAndLink(goalId, flow.swapGoalId);
      } else {
        onLink(goalId);
      }
      setFlow({ step: GoalFlowStep.Idle });
    },
    [flow, onLink, onSwapAndLink]
  );

  const handleCreateNewClick = useCallback(() => {
    setDirection(SlideDirection.Forward);
    const swapGoalId = flow.step === GoalFlowStep.Browsing ? flow.swapGoalId : undefined;
    setFlow({ step: GoalFlowStep.Creating, swapGoalId });
  }, [flow]);

  const handleCreateBack = useCallback(() => {
    setDirection(SlideDirection.Backward);
    const swapGoalId = flow.step === GoalFlowStep.Creating ? flow.swapGoalId : undefined;
    setFlow({ step: GoalFlowStep.Browsing, swapGoalId });
  }, [flow]);

  const handleFormSubmit = useCallback(
    async (title: string, body?: string) => {
      setDirection(SlideDirection.Backward);
      if (flow.step === GoalFlowStep.Creating && flow.swapGoalId) {
        await onCreateAndSwap(title, flow.swapGoalId, body);
      } else {
        await onCreateAndLink(title, body);
      }
      setFlow({ step: GoalFlowStep.Idle });
    },
    [flow, onCreateAndLink, onCreateAndSwap]
  );

  const handleBack = useCallback(() => {
    setDirection(SlideDirection.Backward);
    switch (flow.step) {
      case GoalFlowStep.Creating:
        setFlow({ step: GoalFlowStep.Browsing, swapGoalId: flow.swapGoalId });
        break;
      case GoalFlowStep.Browsing:
        if (flow.swapGoalId) {
          setFlow({ step: GoalFlowStep.SelectingSwap });
        } else {
          setFlow({ step: GoalFlowStep.Idle });
        }
        break;
      case GoalFlowStep.SelectingSwap:
        setFlow({ step: GoalFlowStep.Idle });
        break;
      case GoalFlowStep.Idle:
        break;
      default: {
        const _exhaustive: never = flow;
        throw new Error(`Unhandled flow step: ${(_exhaustive as GoalFlowState).step}`);
      }
    }
  }, [flow]);

  const handleCancel = useCallback(() => {
    setDirection(SlideDirection.Backward);
    setFlow({ step: GoalFlowStep.Idle });
  }, []);

  return useMemo(() => ({
    flow,
    direction,
    availableGoals,
    swapCandidates,
    handleBack,
    handleAddGoalClick,
    handleSwapSelected,
    handleBrowseGoalClick,
    handleCreateNewClick,
    handleCreateBack,
    handleFormSubmit,
    handleCancel,
    enterSwapForLink,
  }), [
    flow,
    direction,
    availableGoals,
    swapCandidates,
    handleBack,
    handleAddGoalClick,
    handleSwapSelected,
    handleBrowseGoalClick,
    handleCreateNewClick,
    handleCreateBack,
    handleFormSubmit,
    handleCancel,
    enterSwapForLink,
  ]);
}
