import { useState, useCallback, useMemo } from "react";
import type { Goal } from "@/types/goal";
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
  | { step: GoalFlowStep.SelectingSwap }
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

  const handleSwapSelected = useCallback((goalId: string) => {
    setDirection(SlideDirection.Forward);
    setFlow({ step: GoalFlowStep.Browsing, swapGoalId: goalId });
  }, []);

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
    handleBack,
    handleAddGoalClick,
    handleSwapSelected,
    handleBrowseGoalClick,
    handleCreateNewClick,
    handleCreateBack,
    handleFormSubmit,
    handleCancel,
  }), [
    flow,
    direction,
    availableGoals,
    handleBack,
    handleAddGoalClick,
    handleSwapSelected,
    handleBrowseGoalClick,
    handleCreateNewClick,
    handleCreateBack,
    handleFormSubmit,
    handleCancel,
  ]);
}
