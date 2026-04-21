import React from "react";
import { cn } from "@/components/lib/utils";
import type { Goal } from "@/types/goal";
import { goalTitle } from "@/types/goal";

interface SessionGoalListProps {
  /** Goals to display — one row per goal. */
  goals: Goal[];
  /** Tailwind classes applied to the colored dot marker. */
  dotClassName?: string;
  /** Tailwind classes applied to the goal title text. */
  textClassName?: string;
  /** Tailwind class controlling vertical spacing between rows. */
  gapClassName?: string;
  /** Rendered when `goals` is empty. Nothing is rendered if omitted. */
  emptyFallback?: React.ReactNode;
}

/**
 * Read-only list of a session's linked goals, rendered as a tight column of
 * dot + title rows. Used by the dashboard Upcoming Session card, session
 * hover previews, and anywhere else a session's goal set needs a compact
 * presentation. Does not fetch data or handle interactions — callers wrap
 * rows with links/popovers if needed.
 */
export function SessionGoalList({
  goals,
  dotClassName = "bg-emerald-800/50",
  textClassName = "text-sm text-muted-foreground",
  gapClassName = "gap-0.5",
  emptyFallback,
}: SessionGoalListProps) {
  if (goals.length === 0) {
    return emptyFallback ? <>{emptyFallback}</> : null;
  }

  return (
    <div className={cn("flex flex-col", gapClassName)}>
      {goals.map((goal) => (
        <div
          key={goal.id}
          data-testid="session-goal-row"
          className="flex items-center gap-2"
        >
          <span
            data-testid="session-goal-dot"
            className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0",
              dotClassName,
            )}
          />
          <span
            data-testid="session-goal-text"
            className={cn("truncate", textClassName)}
          >
            {goalTitle(goal)}
          </span>
        </div>
      ))}
    </div>
  );
}
