"use client";

import { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Circle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/components/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { GoalChip } from "@/components/ui/coaching-sessions/goal-chip";
import { GoalPicker } from "@/components/ui/coaching-sessions/goal-picker";
import {
  useGoalsBySession,
  useGoalList,
  useGoalMutation,
  GoalApi,
} from "@/lib/api/goals";
import { useGoalProgress } from "@/lib/api/goal-progress";
import type { Goal } from "@/types/goal";
import {
  goalTitle,
  defaultGoal,
  DEFAULT_MAX_ACTIVE_GOALS,
  extractActiveGoalLimitError,
} from "@/types/goal";
import type { Id } from "@/types/general";
import { ItemStatus } from "@/types/general";
import { GoalProgress } from "@/types/goal-progress";
import type { GoalProgressMetrics } from "@/types/goal-progress";
import { Some } from "@/types/option";

// ── Health signal helpers ──────────────────────────────────────────────

function progressDotColor(progress: GoalProgress): string {
  switch (progress) {
    case GoalProgress.SolidMomentum:
      return "bg-emerald-800/50";
    case GoalProgress.NeedsAttention:
      return "bg-amber-500/60";
    case GoalProgress.LetsRefocus:
      return "bg-rose-500/50";
    default: {
      const _exhaustive: never = progress;
      throw new Error(`Unhandled GoalProgress: ${_exhaustive}`);
    }
  }
}

function progressLabel(progress: GoalProgress): string {
  switch (progress) {
    case GoalProgress.SolidMomentum:
      return "Solid momentum";
    case GoalProgress.NeedsAttention:
      return "Needs attention";
    case GoalProgress.LetsRefocus:
      return "Let\u2019s refocus";
    default: {
      const _exhaustive: never = progress;
      throw new Error(`Unhandled GoalProgress: ${_exhaustive}`);
    }
  }
}

// ── Goal Progress Card ─────────────────────────────────────────────────

interface GoalProgressCardProps {
  goal: Goal;
}

function GoalProgressCard({ goal }: GoalProgressCardProps) {
  const { progressMetrics } = useGoalProgress(Some(goal.id));

  const percent =
    progressMetrics.actions_total > 0
      ? Math.round(
          (progressMetrics.actions_completed / progressMetrics.actions_total) *
            100
        )
      : 0;
  const remaining =
    progressMetrics.actions_total - progressMetrics.actions_completed;

  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 overflow-hidden transition-colors hover:border-border">
      <div className="flex flex-col md:flex-row">
        {/* Left panel — goal summary */}
        <div className="flex-1 p-4 space-y-3 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  progressDotColor(progressMetrics.progress)
                )}
              />
              <span className="text-[13px] font-medium truncate">
                {goalTitle(goal)}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground/60 shrink-0">
              {progressLabel(progressMetrics.progress)}
            </span>
          </div>

          {progressMetrics.actions_total > 0 && (
            <div className="h-1 w-full rounded-full bg-border/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-foreground/20 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {progressMetrics.actions_total > 0 ? (
              <>
                <span>
                  {remaining} action{remaining !== 1 ? "s" : ""} remaining
                </span>
                <span className="text-muted-foreground/30">&middot;</span>
                <span>{percent}% complete</span>
              </>
            ) : (
              <span className="italic text-muted-foreground/50">
                No actions yet
              </span>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground/50">
            {progressMetrics.linked_session_count > 0
              ? `${progressMetrics.linked_session_count} session${progressMetrics.linked_session_count !== 1 ? "s" : ""}`
              : "Not discussed yet"}
            {progressMetrics.last_session_date.some && (
              <span> &middot; Last discussed {progressMetrics.last_session_date.val}</span>
            )}
          </p>
        </div>

        {/* Divider — vertical on desktop, horizontal on mobile */}
        <div className="h-px md:h-auto md:w-px bg-border/30 shrink-0" />

        {/* Right panel — actions for review */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Actions for review
            </p>
          </div>
          {progressMetrics.actions_total === 0 ? (
            <p className="text-xs text-muted-foreground/40 italic">
              No actions yet
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/50">
              {progressMetrics.actions_completed} of{" "}
              {progressMetrics.actions_total} actions completed
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Goal Drawer ────────────────────────────────────────────────────────

interface GoalDrawerProps {
  coachingSessionId: Id;
  coachingRelationshipId: Id;
}

export function GoalDrawer({
  coachingSessionId,
  coachingRelationshipId,
}: GoalDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { goals: linkedGoals, refresh: refreshSessionGoals } =
    useGoalsBySession(coachingSessionId);
  const { goals: allGoals, refresh: refreshAllGoals } =
    useGoalList(coachingRelationshipId);
  const { create: createGoal, update: updateGoal } = useGoalMutation();

  const linkedGoalIds = new Set(linkedGoals.map((g) => g.id));
  const atLimit = linkedGoals.length >= DEFAULT_MAX_ACTIVE_GOALS;

  const handleLink = useCallback(
    async (goalId: string) => {
      const result = await GoalApi.linkToSession(coachingSessionId, goalId);
      result.match(
        () => refreshSessionGoals(),
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
    [coachingSessionId, refreshSessionGoals]
  );

  const handleUnlink = useCallback(
    async (goalId: string) => {
      const result = await GoalApi.unlinkFromSession(
        coachingSessionId,
        goalId
      );
      result.match(
        () => refreshSessionGoals(),
        (err) => {
          console.error("Failed to unlink goal:", err);
          toast({
            variant: "destructive",
            title: "Failed to unlink goal",
            description: err.message,
          });
        }
      );
    },
    [coachingSessionId, refreshSessionGoals]
  );

  const handleCreateAndLink = useCallback(
    async (title: string) => {
      try {
        const newGoal = defaultGoal();
        newGoal.coaching_relationship_id = coachingRelationshipId;
        newGoal.created_in_session_id = coachingSessionId;
        newGoal.title = title;
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
    async (title: string, swapGoalId: string) => {
      try {
        // 1. Put the swapped goal on hold
        const swapGoal = allGoals.find((g) => g.id === swapGoalId);
        if (swapGoal) {
          await updateGoal(swapGoalId, {
            ...swapGoal,
            status: ItemStatus.WontDo,
          });
        }

        // 2. Unlink the swapped goal
        await GoalApi.unlinkFromSession(coachingSessionId, swapGoalId);

        // 3. Create the new goal (backend auto-links via created_in_session_id)
        const newGoal = defaultGoal();
        newGoal.coaching_relationship_id = coachingRelationshipId;
        newGoal.created_in_session_id = coachingSessionId;
        newGoal.title = title;
        newGoal.status = ItemStatus.InProgress;

        await createGoal(newGoal);

        refreshSessionGoals();
        refreshAllGoals();
      } catch (err) {
        console.error("Failed to create and swap goal:", err);
        toast({
          variant: "destructive",
          title: "Failed to swap goal",
          description: "An error occurred while swapping goals.",
        });
      }
    },
    [
      allGoals,
      coachingSessionId,
      coachingRelationshipId,
      createGoal,
      updateGoal,
      refreshSessionGoals,
      refreshAllGoals,
    ]
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      {/* Goal bar — inset style */}
      <div className="flex items-center gap-3 min-h-[36px] rounded-[0.5rem] bg-muted shadow-inner hover:bg-gray-200 transition-colors px-3">
        <span className="text-[13px] font-semibold text-muted-foreground shrink-0">
          Goals
        </span>
        <div className="flex flex-wrap items-center gap-2 flex-1 py-1">
          {linkedGoals.length === 0 ? (
            <span className="text-sm text-muted-foreground/60 italic">
              No goals linked to this session
            </span>
          ) : (
            linkedGoals.map((goal) => {
              return (
                <GoalChipWithProgress
                  key={goal.id}
                  goal={goal}
                  onRemove={() => handleUnlink(goal.id)}
                />
              );
            })
          )}

          <GoalPicker
            linkedGoalIds={linkedGoalIds}
            allGoals={allGoals}
            linkedGoals={linkedGoals}
            onLink={handleLink}
            onCreateAndLink={handleCreateAndLink}
            onCreateAndSwap={handleCreateAndSwap}
            atLimit={atLimit}
          />
        </div>

        {/* Counter + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {linkedGoals.length > 0 && (
            <span className="text-[11px] text-muted-foreground/50 tabular-nums">
              {linkedGoals.length}/{DEFAULT_MAX_ACTIVE_GOALS}
            </span>
          )}
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-gray-300"
              aria-label={isOpen ? "Collapse goals" : "Expand goals"}
            >
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      {/* Expanded content — goal progress cards */}
      <CollapsibleContent>
        <div className="pt-2 pb-4">
          {linkedGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground/50 italic py-2">
              Link a goal above to see its progress here.
            </p>
          ) : (
            <div className="space-y-3">
              {linkedGoals.map((goal) => (
                <GoalProgressCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── GoalChip wrapper that fetches its own progress ─────────────────────

function GoalChipWithProgress({
  goal,
  onRemove,
}: {
  goal: Goal;
  onRemove: () => void;
}) {
  const { progressMetrics } = useGoalProgress(Some(goal.id));

  return (
    <GoalChip
      goal={goal}
      actionsCompleted={progressMetrics.actions_completed}
      actionsTotal={progressMetrics.actions_total}
      onRemove={onRemove}
    />
  );
}
