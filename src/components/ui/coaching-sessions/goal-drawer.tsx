"use client";

import { useState, useCallback, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

// ── Compact Goal Card (used in both desktop panel and mobile expanded) ─

interface CompactGoalCardProps {
  goal: Goal;
  onRemove: () => void;
}

function CompactGoalCard({ goal, onRemove }: CompactGoalCardProps) {
  const { progressMetrics } = useGoalProgress(Some(goal.id));
  const titleRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const checkTruncation = useCallback(() => {
    const el = titleRef.current;
    if (el) {
      setIsTruncated(el.scrollHeight > el.clientHeight);
    }
  }, []);

  const percent =
    progressMetrics.actions_total > 0
      ? Math.round(
          (progressMetrics.actions_completed / progressMetrics.actions_total) *
            100
        )
      : 0;
  const remaining =
    progressMetrics.actions_total - progressMetrics.actions_completed;

  const title = goalTitle(goal);

  const cardContent = (
    <div
      onMouseEnter={checkTruncation}
      className="rounded-lg border border-border/50 bg-background p-3 space-y-2 group/card transition-colors hover:border-border"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0 mt-1.5",
              progressDotColor(progressMetrics.progress)
            )}
          />
          <span ref={titleRef} className="text-[13px] font-medium line-clamp-2">
            {title}
          </span>
        </div>
        <button
          type="button"
          aria-label={`Remove ${title}`}
          onClick={onRemove}
          className="rounded-md p-0.5 text-muted-foreground/0 group-hover/card:text-muted-foreground/40 hover:!text-destructive hover:!bg-destructive/10 transition-colors shrink-0"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {progressMetrics.actions_total > 0 && (
        <div className="h-1 w-full rounded-full bg-border/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground/20 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground/60">
        <span>{progressLabel(progressMetrics.progress)}</span>
        {progressMetrics.actions_total > 0 ? (
          <span>
            {remaining} action{remaining !== 1 ? "s" : ""} left &middot; {percent}%
          </span>
        ) : (
          <span className="italic">No actions yet</span>
        )}
      </div>
    </div>
  );

  if (!isTruncated) return cardContent;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[280px]">
          <p className="font-medium">{title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Full Goal Progress Card (used in mobile expanded view) ─────────────

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

// ── Shared props for both layouts ──────────────────────────────────────

interface GoalPanelSharedProps {
  linkedGoals: Goal[];
  allGoals: Goal[];
  linkedGoalIds: Set<string>;
  atLimit: boolean;
  onLink: (goalId: string) => void;
  onUnlink: (goalId: string) => void;
  onCreateAndLink: (title: string) => void;
  onCreateAndSwap: (title: string, swapGoalId: string) => void;
  onSwapAndLink: (newGoalId: string, swapGoalId: string) => void;
}

// ── Desktop Goals Panel ────────────────────────────────────────────────

function GoalsPanelDesktop({
  linkedGoals,
  allGoals,
  linkedGoalIds,
  atLimit,
  onLink,
  onUnlink,
  onCreateAndLink,
  onCreateAndSwap,
  onSwapAndLink,
}: GoalPanelSharedProps) {
  return (
    <Card className="hidden md:flex md:flex-col md:sticky md:top-4 md:self-start">
      <CardHeader className="p-4 pb-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Goals</h3>
          {linkedGoals.length > 0 && (
            <span className="text-[11px] text-muted-foreground/50 tabular-nums">
              {linkedGoals.length}/{DEFAULT_MAX_ACTIVE_GOALS}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {linkedGoals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 py-6 px-4 text-center">
            <p className="text-sm text-muted-foreground/50 italic">
              No goals set for this session
            </p>
          </div>
        ) : (
          linkedGoals.map((goal) => (
            <CompactGoalCard
              key={goal.id}
              goal={goal}
              onRemove={() => onUnlink(goal.id)}
            />
          ))
        )}

        <GoalPicker
          linkedGoalIds={linkedGoalIds}
          allGoals={allGoals}
          linkedGoals={linkedGoals}
          onLink={onLink}
          onCreateAndLink={onCreateAndLink}
          onCreateAndSwap={onCreateAndSwap}
          onSwapAndLink={onSwapAndLink}
          atLimit={atLimit}
        />
      </CardContent>
    </Card>
  );
}

// ── Mobile Goals Panel ─────────────────────────────────────────────────

function GoalsPanelMobile({
  linkedGoals,
  allGoals,
  linkedGoalIds,
  atLimit,
  onLink,
  onUnlink,
  onCreateAndLink,
  onCreateAndSwap,
  onSwapAndLink,
}: GoalPanelSharedProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="md:hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-3 min-h-[44px] px-4">
          <span className="text-sm font-semibold text-foreground shrink-0">
            Goals
          </span>
          {linkedGoals.length > 0 && (
            <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">
              {linkedGoals.length}/{DEFAULT_MAX_ACTIVE_GOALS}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2 flex-1 py-1">
            {linkedGoals.length === 0 ? (
              <span className="text-sm text-muted-foreground/50 italic">
                No goals set for this session
              </span>
            ) : (
              linkedGoals.map((goal) => (
                <GoalChipWithProgress
                  key={goal.id}
                  goal={goal}
                  onRemove={() => onUnlink(goal.id)}
                />
              ))
            )}

            <GoalPicker
              linkedGoalIds={linkedGoalIds}
              allGoals={allGoals}
              linkedGoals={linkedGoals}
              onLink={onLink}
              onCreateAndLink={onCreateAndLink}
              onCreateAndSwap={onCreateAndSwap}
              onSwapAndLink={onSwapAndLink}
              atLimit={atLimit}
            />
          </div>

          <div className="flex items-center shrink-0">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
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

        <CollapsibleContent>
          <div className="px-4 pt-1 pb-4">
            {linkedGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground/50 italic py-2">
                Set a goal above to see its progress here.
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
    </Card>
  );
}

// ── Goal Drawer (main export) ──────────────────────────────────────────

interface GoalDrawerProps {
  coachingSessionId: Id;
  coachingRelationshipId: Id;
}

export function GoalDrawer({
  coachingSessionId,
  coachingRelationshipId,
}: GoalDrawerProps) {
  const { goals: linkedGoals, refresh: refreshSessionGoals } =
    useGoalsBySession(coachingSessionId);
  const { goals: allGoals, refresh: refreshAllGoals } =
    useGoalList(coachingRelationshipId);
  const { create: createGoal, update: updateGoal } = useGoalMutation();

  const linkedGoalIds = new Set(linkedGoals.map((g) => g.id));
  const atLimit = linkedGoals.length >= DEFAULT_MAX_ACTIVE_GOALS;

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
            status: ItemStatus.OnHold,
          });
        }

        // 2. Unlink the swapped goal
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

  const handleSwapAndLink = useCallback(
    async (newGoalId: string, swapGoalId: string) => {
      try {
        // 1. Put the swapped goal on hold
        const swapGoal = allGoals.find((g) => g.id === swapGoalId);
        if (swapGoal) {
          await updateGoal(swapGoalId, {
            ...swapGoal,
            status: ItemStatus.OnHold,
          });
        }

        // 2. Unlink the swapped goal
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

        // 3. Link the replacement goal
        const linkResult = await GoalApi.linkToSession(coachingSessionId, newGoalId);
        if (linkResult.isErr()) {
          console.error("Failed to link replacement goal:", linkResult.error);
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
      updateGoal,
      refreshSessionGoals,
      refreshAllGoals,
    ]
  );

  const sharedProps: GoalPanelSharedProps = {
    linkedGoals,
    allGoals,
    linkedGoalIds,
    atLimit,
    onLink: handleLink,
    onUnlink: handleUnlink,
    onCreateAndLink: handleCreateAndLink,
    onCreateAndSwap: handleCreateAndSwap,
    onSwapAndLink: handleSwapAndLink,
  };

  return (
    <>
      <GoalsPanelDesktop {...sharedProps} />
      <GoalsPanelMobile {...sharedProps} />
    </>
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
