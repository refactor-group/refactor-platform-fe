"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useGoalProgressList } from "@/lib/api/goal-progress";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useTodaysSessions } from "@/lib/hooks/use-todays-sessions";
import {
  getSessionParticipantName,
  selectNextUpcomingSession,
} from "@/lib/utils/session";
import { maxActiveGoals } from "@/types/goal";
import { GoalProgress } from "@/types/goal-progress";
import type { GoalWithProgress } from "@/types/goal-progress";
import { ProgressRing } from "@/components/ui/dashboard/progress-ring";
import { GoalRow } from "@/components/ui/dashboard/goal-row";
import { GoalsOverviewCardEmpty } from "@/components/ui/dashboard/goals-overview-card-empty";

/** Maps GoalProgress to a severity rank for computing the aggregate signal. */
function progressSeverity(progress: GoalProgress): number {
  switch (progress) {
    case GoalProgress.SolidMomentum:
      return 0;
    case GoalProgress.NeedsAttention:
      return 1;
    case GoalProgress.LetsRefocus:
      return 2;
    default: {
      const _exhaustive: never = progress;
      throw new Error(`Unhandled GoalProgress: ${_exhaustive}`);
    }
  }
}

function HealthSignal({ progress }: { progress: GoalProgress }) {
  switch (progress) {
    case GoalProgress.SolidMomentum:
      return (
        <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowUpRight className="h-3.5 w-3.5" />
          Solid momentum
        </span>
      );
    case GoalProgress.NeedsAttention:
      return (
        <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          Needs attention
        </span>
      );
    case GoalProgress.LetsRefocus:
      return (
        <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowDownRight className="h-3.5 w-3.5" />
          Let&apos;s refocus
        </span>
      );
    default: {
      const _exhaustive: never = progress;
      throw new Error(`Unhandled GoalProgress: ${_exhaustive}`);
    }
  }
}

/** Computes the aggregate (worst) health signal across all goals. */
function aggregateProgress(goals: GoalWithProgress[]): GoalProgress {
  if (goals.length === 0) return GoalProgress.SolidMomentum;

  let worst = GoalProgress.SolidMomentum;
  for (const goal of goals) {
    if (progressSeverity(goal.progress_metrics.progress) > progressSeverity(worst)) {
      worst = goal.progress_metrics.progress;
    }
  }
  return worst;
}

function GoalsOverviewCardSkeleton() {
  return (
    <Card className="border shadow-none h-full">
      <CardContent className="p-6">
        <div className="flex items-center gap-4 animate-pulse">
          <div className="h-12 w-12 rounded-full bg-muted" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-32 bg-muted rounded" />
            <div className="h-5 w-8 bg-muted rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function GoalsOverviewCard() {
  const [expanded, setExpanded] = useState(true);
  const { userId } = useAuthStore((state) => ({ userId: state.userId }));
  const { sessions: todaysSessions, isLoading: isSessionsLoading } =
    useTodaysSessions();
  const upcomingSession = selectNextUpcomingSession(todaysSessions);

  const organizationId = upcomingSession?.organization?.id ?? null;
  const relationshipId = upcomingSession?.coaching_relationship_id ?? null;

  // The card shows the same goals the Upcoming Session card shows —
  // whatever's linked to that session via the join table, any status.
  // We fetch the full relationship's goal_progress (no server-side filter)
  // and intersect with `upcomingSession.goals` below to pick up each linked
  // goal's progress metrics (action counts, session counts, signal). A
  // follow-up backend param (?coaching_session_id=<uuid>) would let us push
  // this filter down server-side; until then the relationship-scoped fetch
  // is the only way to get progress_metrics per goal.
  const {
    goalsWithProgress,
    isLoading: isGoalsLoading,
    isError,
  } = useGoalProgressList(organizationId, relationshipId);

  // Show loading chrome while either fetch is in flight.
  if (isSessionsLoading || (organizationId && isGoalsLoading)) {
    return <GoalsOverviewCardSkeleton />;
  }

  // No upcoming session → nothing to show goals for.
  if (!upcomingSession) {
    return <GoalsOverviewCardEmpty />;
  }

  // Silent fallback on error — don't break the dashboard
  if (isError) return null;

  const coacheeName = userId
    ? getSessionParticipantName(upcomingSession, userId)
    : "";

  // Intersect the relationship's full progress list with the session's
  // linked goals — renders the same set the Upcoming Session card shows,
  // one row per goal with its progress metrics.
  // Preserves the session's own ordering (backend decides). Defensive cap
  // at maxActiveGoals() in case a session ever has more linked goals than
  // the product limit; if a linked goal is missing from the progress list
  // (shouldn't happen — join table FK enforces existence), it's skipped.
  const sessionLinkedGoalIds = new Set(
    (upcomingSession.goals ?? []).map((g) => g.id)
  );
  const progressByGoalId = new Map(
    goalsWithProgress.map((g) => [g.goal_id, g])
  );
  const activeGoals = (upcomingSession.goals ?? [])
    .map((g) => progressByGoalId.get(g.id))
    .filter((g): g is GoalWithProgress => g !== undefined && sessionLinkedGoalIds.has(g.goal_id))
    .slice(0, maxActiveGoals());

  const totalActions = activeGoals.reduce(
    (sum, g) => sum + g.progress_metrics.actions_total,
    0
  );
  const completedActions = activeGoals.reduce(
    (sum, g) => sum + g.progress_metrics.actions_completed,
    0
  );
  const overallPercent =
    totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;
  const overallProgress = aggregateProgress(activeGoals);

  return (
    <Card className="border shadow-none h-full">
      <Collapsible
        open={expanded}
        onOpenChange={setExpanded}
        className="flex flex-col h-full"
      >
        <CardContent className="p-0 flex flex-col flex-1">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between gap-4 p-6 text-left hover:bg-muted/20 transition-colors rounded-xl"
            >
              {/* Left: ring + label/value */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        role="img"
                        aria-label={`${completedActions} of ${totalActions} actions completed`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ProgressRing percent={overallPercent} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {completedActions} of {totalActions} actions completed
                      across active goals
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {coacheeName}&apos;s active goals
                  </p>
                  <p className="text-lg font-semibold tabular-nums -mt-0.5">
                    {activeGoals.length}
                  </p>
                </div>
              </div>

              {/* Right: health signal + chevron */}
              <div className="flex items-center gap-3 shrink-0">
                <HealthSignal progress={overallProgress} />
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground/40 transition-transform duration-200",
                    expanded && "rotate-180"
                  )}
                />
              </div>
            </button>
          </CollapsibleTrigger>

          {/* Expandable goal list */}
          <CollapsibleContent className="flex-1 flex flex-col data-[state=closed]:flex-initial">
            <div className="border-t mx-6" />
            <div className="px-6 pb-5 pt-2 flex flex-col flex-1">
              {activeGoals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No active goals
                </p>
              ) : (
                <div className="divide-y divide-border/50">
                  {activeGoals.map((goal) => (
                    <GoalRow
                      key={goal.goal_id}
                      title={goal.title}
                      actionsCompleted={
                        goal.progress_metrics.actions_completed
                      }
                      actionsTotal={goal.progress_metrics.actions_total}
                      linkedSessionCount={
                        goal.progress_metrics.linked_coaching_session_count
                      }
                    />
                  ))}
                </div>
              )}
              {/* TODO: Flip this `false` to render the "View all goals" link
                  once the global Goals page lands — the button already points
                  at nothing, so showing a disabled CTA just adds noise. */}
              {false && (
                <div className="pt-3 mt-auto flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground gap-1 h-7"
                    disabled
                  >
                    View all goals
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
