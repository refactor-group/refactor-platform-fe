"use client";

import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { toast as sonnerToast } from "sonner";
import { CompactGoalCard } from "@/components/ui/coaching-sessions/goal-card-compact";
import { GoalBrowseView } from "@/components/ui/coaching-sessions/goal-browse-view";
import { GoalCreateForm } from "@/components/ui/coaching-sessions/goal-create-form";
import { GoalsPanelDesktop } from "@/components/ui/coaching-sessions/goal-panel-desktop";
import { GoalsPanelMobile } from "@/components/ui/coaching-sessions/goal-panel-mobile";
import {
  GoalFlowStep,
  SlideDirection,
  useGoalFlow,
} from "@/components/ui/coaching-sessions/goal-flow";
import type { GoalFlowState } from "@/components/ui/coaching-sessions/goal-flow";
import {
  useGoalsBySession,
  useGoalList,
  useGoalMutation,
  GoalApi,
} from "@/lib/api/goals";
import type { Goal } from "@/types/goal";
import {
  defaultGoal,
  extractActiveGoalLimitError,
  goalTitle,
  isAtGoalLimit,
  maxActiveGoals,
} from "@/types/goal";
import type { Id } from "@/types/general";
import { ItemStatus } from "@/types/general";

// ── Shared props for both layouts ──────────────────────────────────────

export interface GoalPanelSharedProps {
  linkedGoals: Goal[];
  allGoals: Goal[];
  linkedGoalIds: Set<string>;
  atLimit: boolean;
  goalFlow: ReturnType<typeof useGoalFlow>;
  onLink: (goalId: string) => void;
  onUnlink: (goalId: string) => void;
  onCreateAndLink: (title: string, body?: string) => void;
  onCreateAndSwap: (title: string, swapGoalId: string, body?: string) => void;
  onSwapAndLink: (newGoalId: string, swapGoalId: string) => void;
  onUpdateGoal: (goalId: string, title: string, body: string) => Promise<void>;
  /** When true, goal linkage is immutable (past sessions) */
  readOnly?: boolean;
}

// ── Slide Panel (animate in on mount via CSS) ────────────────────────

function SlidePanel({
  children,
  direction = SlideDirection.Forward,
}: {
  children: React.ReactNode;
  direction?: SlideDirection;
}) {
  return (
    <div className={cn(
      "animate-in fade-in duration-200 fill-mode-both",
      direction === SlideDirection.Forward
        ? "slide-in-from-right-4"
        : "slide-in-from-left-4"
    )}>
      {children}
    </div>
  );
}

// ── Goal Flow Pages (shared wizard content for both layouts) ─────────

export function GoalFlowPages({
  linkedGoals,
  goalFlow,
  readOnly,
  onUnlink,
  onUpdateGoal,
}: {
  linkedGoals: Goal[];
  goalFlow: ReturnType<typeof useGoalFlow>;
  readOnly: boolean;
  onUnlink: (goalId: string) => void;
  onUpdateGoal: (goalId: string, title: string, body: string) => Promise<void>;
}) {
  const { flow } = goalFlow;

  switch (flow.step) {
    case GoalFlowStep.Idle:
      return (
        <div className="space-y-3">
          {linkedGoals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/50 py-6 px-4 text-center">
              <p className="text-sm text-muted-foreground/50 italic">
                No goals added yet
              </p>
            </div>
          ) : (
            linkedGoals.map((goal) => (
              <CompactGoalCard
                key={goal.id}
                goal={goal}
                onRemove={readOnly ? undefined : () => onUnlink(goal.id)}
                onUpdate={readOnly ? undefined : onUpdateGoal}
              />
            ))
          )}
        </div>
      );

    case GoalFlowStep.SelectingSwap:
      return (
        <SlidePanel direction={goalFlow.direction}>
          <div className="rounded-lg border border-border bg-background p-3 space-y-3">
            <p className="text-[12px] text-muted-foreground">
              You already have {maxActiveGoals()} goals in progress. Select an existing goal to replace with a new one.
            </p>
            {linkedGoals.map((goal) => (
              <CompactGoalCard
                key={goal.id}
                goal={goal}
                swapMode={{ onSelect: () => goalFlow.handleSwapSelected(goal.id) }}
              />
            ))}
            <div className="flex items-center justify-end pt-2 border-t border-border/30">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={goalFlow.handleCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        </SlidePanel>
      );

    case GoalFlowStep.Browsing:
      return (
        <SlidePanel direction={goalFlow.direction}>
          <GoalBrowseView
            availableGoals={goalFlow.availableGoals}
            onGoalClick={goalFlow.handleBrowseGoalClick}
            onCreateNew={goalFlow.handleCreateNewClick}
            onCancel={goalFlow.handleBack}
            hint={flow.swapGoalId
              ? "Choose a replacement goal or create a new one."
              : "Choose an existing goal or create a new one."
            }
          />
        </SlidePanel>
      );

    case GoalFlowStep.Creating:
      return (
        <SlidePanel direction={goalFlow.direction}>
          <GoalCreateForm
            onSubmit={goalFlow.handleFormSubmit}
            onCancel={goalFlow.handleBack}
            submitLabel="Save"
          />
        </SlidePanel>
      );

    default: {
      const _exhaustive: never = flow;
      throw new Error(`Unhandled flow step: ${(_exhaustive as GoalFlowState).step}`);
    }
  }
}

// ── Goal Panel (main export) ──────────────────────────────────────────

interface GoalPanelProps {
  coachingSessionId: Id;
  coachingRelationshipId: Id;
  collapsed?: boolean;
  /** When true, goal linkage is immutable (past sessions) */
  readOnly?: boolean;
}

export function GoalPanel({
  coachingSessionId,
  coachingRelationshipId,
  collapsed = false,
  readOnly = false,
}: GoalPanelProps) {
  const { goals: linkedGoals, refresh: refreshSessionGoals } =
    useGoalsBySession(coachingSessionId);
  const { goals: allGoals, refresh: refreshAllGoals } =
    useGoalList(coachingRelationshipId);
  const { create: createGoal, update: updateGoal } = useGoalMutation();

  const linkedGoalIds = useMemo(() => new Set(linkedGoals.map((g) => g.id)), [linkedGoals]);
  const inProgressGoals = allGoals.filter((g) => g.status === ItemStatus.InProgress);
  const atLimit = isAtGoalLimit(inProgressGoals, linkedGoals);

  const handleLink = useCallback(
    async (goalId: string) => {
      // If the goal is OnHold, transition it to InProgress before linking
      const goal = allGoals.find((g) => g.id === goalId);
      if (goal && goal.status === ItemStatus.OnHold) {
        try {
          await updateGoal(goalId, { ...goal, status: ItemStatus.InProgress });
        } catch (err) {
          const limitInfo = extractActiveGoalLimitError(err);
          if (limitInfo) {
            toast({
              variant: "destructive",
              title: "Goal limit reached",
              description: `You already have ${limitInfo.maxActiveGoals} goals in progress. Please complete or change the status of one before starting another.`,
            });
          } else {
            console.error("Failed to activate goal:", err);
          }
          return;
        }
      }

      const result = await GoalApi.linkToSession(coachingSessionId, goalId);
      result.match(
        () => {
          refreshSessionGoals();
          refreshAllGoals();
        },
        (err) => {
          console.error("Failed to link goal:", err);
          toast({
            variant: "destructive",
            title: "Failed to link goal",
            description: err.message,
          });
        }
      );
    },
    [coachingSessionId, allGoals, updateGoal, refreshSessionGoals, refreshAllGoals]
  );

  const handleUnlink = useCallback(
    async (goalId: string) => {
      const goal = allGoals.find((g) => g.id === goalId);
      const previousStatus = goal?.status;

      const result = await GoalApi.unlinkFromSession(
        coachingSessionId,
        goalId
      );
      result.match(
        async () => {
          // Auto-hold the goal when unlinking from a current/future session
          if (!readOnly && goal && goal.status === ItemStatus.InProgress) {
            try {
              await updateGoal(goalId, { ...goal, status: ItemStatus.OnHold });
            } catch (err) {
              console.error("Failed to put goal on hold after unlink:", err);
            }
          }
          refreshSessionGoals();
          refreshAllGoals();

          // Show undo toast
          const name = goal ? goalTitle(goal) : "Goal";
          sonnerToast(`"${name}" removed from session`, {
            action: {
              label: "Undo",
              onClick: async () => {
                const relinkResult = await GoalApi.linkToSession(coachingSessionId, goalId);
                if (relinkResult.isErr()) {
                  sonnerToast.error("Failed to undo", {
                    description: relinkResult.error.message,
                  });
                  return;
                }
                // Restore the original status if it was changed
                if (!readOnly && goal && previousStatus === ItemStatus.InProgress) {
                  try {
                    await updateGoal(goalId, { ...goal, status: ItemStatus.InProgress });
                  } catch (err) {
                    console.error("Failed to restore goal status:", err);
                  }
                }
                refreshSessionGoals();
                refreshAllGoals();
              },
            },
          });
        },
        (err) => {
          console.error("Failed to unlink goal:", err);
          toast({
            variant: "destructive",
            title: "Failed to remove goal",
            description: err.message,
          });
        }
      );
    },
    [coachingSessionId, readOnly, allGoals, updateGoal, refreshSessionGoals, refreshAllGoals]
  );

  const handleCreateAndLink = useCallback(
    async (title: string, body?: string) => {
      try {
        const newGoal = defaultGoal();
        newGoal.coaching_relationship_id = coachingRelationshipId;
        newGoal.created_in_session_id = coachingSessionId;
        newGoal.title = title;
        if (body) newGoal.body = body;
        newGoal.status = ItemStatus.InProgress;

        await createGoal(newGoal);
        refreshSessionGoals();
        refreshAllGoals();
      } catch (err) {
        const limitInfo = extractActiveGoalLimitError(err);
        if (limitInfo) {
          toast({
            variant: "destructive",
            title: "Goal limit reached",
            description: `You already have ${limitInfo.maxActiveGoals} goals in progress. Please complete or change the status of one before starting another.`,
          });
        } else {
          console.error("Failed to create goal:", err);
        }
      }
    },
    [
      coachingRelationshipId,
      coachingSessionId,
      createGoal,
      refreshSessionGoals,
      refreshAllGoals,
    ]
  );

  const handleCreateAndSwap = useCallback(
    async (title: string, swapGoalId: string, body?: string) => {
      const swapGoal = allGoals.find((g) => g.id === swapGoalId);
      const wasLinked = linkedGoalIds.has(swapGoalId);

      try {
        // 1. Put the swapped goal on hold
        if (swapGoal) {
          await updateGoal(swapGoalId, {
            ...swapGoal,
            status: ItemStatus.OnHold,
          });
        }

        // 2. Unlink the swapped goal from this session (only if it's linked here)
        if (wasLinked) {
          const unlinkResult = await GoalApi.unlinkFromSession(coachingSessionId, swapGoalId);
          if (unlinkResult.isErr()) {
            console.error("Failed to unlink goal during swap:", unlinkResult.error);
            toast({
              variant: "destructive",
              title: "Failed to swap goal",
              description: unlinkResult.error.message,
            });
            return;
          }
        }

        // 3. Create the new goal (backend auto-links via created_in_session_id)
        const newGoal = defaultGoal();
        newGoal.coaching_relationship_id = coachingRelationshipId;
        newGoal.created_in_session_id = coachingSessionId;
        newGoal.title = title;
        if (body) newGoal.body = body;
        newGoal.status = ItemStatus.InProgress;

        await createGoal(newGoal);

        refreshSessionGoals();
        refreshAllGoals();
      } catch (err) {
        console.error("Failed to create and swap goal:", err);

        // Recover: re-link the original goal if it was unlinked
        if (wasLinked) {
          const relinkResult = await GoalApi.linkToSession(coachingSessionId, swapGoalId);
          if (relinkResult.isOk() && swapGoal) {
            await updateGoal(swapGoalId, { ...swapGoal, status: ItemStatus.InProgress }).catch(() => {});
          }
          refreshSessionGoals();
          refreshAllGoals();
        }

        toast({
          variant: "destructive",
          title: "Failed to swap goal",
          description: "An error occurred while swapping goals. The original goal has been restored.",
        });
      }
    },
    [
      allGoals,
      linkedGoalIds,
      coachingSessionId,
      coachingRelationshipId,
      createGoal,
      updateGoal,
      refreshSessionGoals,
      refreshAllGoals,
    ]
  );

  const handleSwapAndLink = useCallback(
    async (newGoalId: string, swapGoalId: string) => {
      const swapGoal = allGoals.find((g) => g.id === swapGoalId);
      const wasLinked = linkedGoalIds.has(swapGoalId);

      try {
        // 1. Put the swapped goal on hold
        if (swapGoal) {
          await updateGoal(swapGoalId, {
            ...swapGoal,
            status: ItemStatus.OnHold,
          });
        }

        // 2. Unlink the swapped goal from this session (only if it's linked here)
        if (wasLinked) {
          const unlinkResult = await GoalApi.unlinkFromSession(coachingSessionId, swapGoalId);
          if (unlinkResult.isErr()) {
            console.error("Failed to unlink goal during swap:", unlinkResult.error);
            toast({
              variant: "destructive",
              title: "Failed to swap goal",
              description: unlinkResult.error.message,
            });
            return;
          }
        }

        // 3. Link the replacement goal
        const linkResult = await GoalApi.linkToSession(coachingSessionId, newGoalId);
        if (linkResult.isErr()) {
          console.error("Failed to link replacement goal:", linkResult.error);

          // Recover: re-link the original goal since the replacement failed
          if (wasLinked) {
            const relinkResult = await GoalApi.linkToSession(coachingSessionId, swapGoalId);
            if (relinkResult.isOk() && swapGoal) {
              await updateGoal(swapGoalId, { ...swapGoal, status: ItemStatus.InProgress }).catch(() => {});
            }
            refreshSessionGoals();
            refreshAllGoals();
          }

          toast({
            variant: "destructive",
            title: "Failed to link replacement goal",
            description: linkResult.error.message,
          });
          return;
        }

        refreshSessionGoals();
        refreshAllGoals();
      } catch (err) {
        console.error("Failed to swap and link goal:", err);

        // Recover: re-link the original goal if it was unlinked
        if (wasLinked) {
          const relinkResult = await GoalApi.linkToSession(coachingSessionId, swapGoalId);
          if (relinkResult.isOk() && swapGoal) {
            await updateGoal(swapGoalId, { ...swapGoal, status: ItemStatus.InProgress }).catch(() => {});
          }
          refreshSessionGoals();
          refreshAllGoals();
        }

        toast({
          variant: "destructive",
          title: "Failed to swap goal",
          description: "An error occurred while swapping goals. The original goal has been restored.",
        });
      }
    },
    [
      allGoals,
      linkedGoalIds,
      coachingSessionId,
      updateGoal,
      refreshSessionGoals,
      refreshAllGoals,
    ]
  );

  const handleUpdateGoal = useCallback(
    async (goalId: string, title: string, body: string) => {
      const goal = allGoals.find((g) => g.id === goalId);
      if (!goal) return;
      try {
        await updateGoal(goalId, { ...goal, title, body });
        refreshSessionGoals();
        refreshAllGoals();
      } catch (err) {
        console.error("Failed to update goal:", err);
        toast({
          variant: "destructive",
          title: "Failed to update goal",
          description: "An error occurred while saving changes.",
        });
      }
    },
    [allGoals, updateGoal, refreshSessionGoals, refreshAllGoals]
  );

  const goalFlow = useGoalFlow({
    atLimit,
    allGoals,
    linkedGoalIds,
    onLink: handleLink,
    onSwapAndLink: handleSwapAndLink,
    onCreateAndLink: handleCreateAndLink,
    onCreateAndSwap: handleCreateAndSwap,
  });

  const sharedProps: GoalPanelSharedProps = {
    linkedGoals,
    allGoals,
    linkedGoalIds,
    atLimit,
    goalFlow,
    onLink: handleLink,
    onUnlink: handleUnlink,
    onCreateAndLink: handleCreateAndLink,
    onCreateAndSwap: handleCreateAndSwap,
    onSwapAndLink: handleSwapAndLink,
    onUpdateGoal: handleUpdateGoal,
    readOnly,
  };

  return (
    <>
      <GoalsPanelDesktop
        {...sharedProps}
        collapsed={collapsed}
      />
      <GoalsPanelMobile {...sharedProps} />
    </>
  );
}
