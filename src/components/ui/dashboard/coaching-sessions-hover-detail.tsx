"use client";

import { useMemo } from "react";
import { MessageSquare } from "lucide-react";
import { SessionGoalList } from "@/components/ui/session-goal-list";
import { ActionStatusIcon } from "@/components/ui/coaching-sessions/action-card-parts";
import { cn } from "@/components/lib/utils";
import type { Action } from "@/types/action";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { ItemStatus } from "@/types/general";

export interface SessionHoverDetailProps {
  session: EnrichedCoachingSession | undefined;
  participantName: string;
  reviewActions: Action[];
}

export function SessionHoverDetail({
  session,
  participantName,
  reviewActions,
}: SessionHoverDetailProps) {
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground/20 mb-3" />
        <p className="text-sm text-muted-foreground/40">
          Hover over a session to see actions due
        </p>
      </div>
    );
  }

  const goals = session.goals ?? [];

  // Sections are siblings under the parent's `gap-4` (set by the wrapper in
  // `coaching-sessions-list-view.tsx`), matching the rhythm of
  // `UpcomingSessionCard`. Internal spacing within each section uses the
  // tighter `mt-2 / gap-2` scale.
  return (
    <>
      <div>
        {/* Title typography mirrors `UpcomingSessionCard`'s HeaderRow
            (`text-base font-semibold text-foreground`) so the same content
            type reads consistently across the dashboard. */}
        <p className="text-base font-semibold text-foreground">
          Session with {participantName}
        </p>
        {goals.length > 0 && (
          <SessionGoalList goals={goals} gapClassName="gap-0.5 mt-2" />
        )}
      </div>

      <div>
        {/* Same eyebrow style as "UPCOMING SESSION" in UpcomingSessionCard:
            `text-xs font-medium uppercase tracking-wider text-muted-foreground/60`. */}
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60 mb-2">
          Actions
        </p>

        {reviewActions.length === 0 ? (
          <p className="text-sm text-muted-foreground/50">
            No actions due for this session.
          </p>
        ) : (
          <div className="space-y-3">
            {reviewActions.map((action) => (
              <ActionDueRow key={action.id} action={action} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ActionDueRow({ action }: { action: Action }) {
  const isCompleted = action.status === ItemStatus.Completed;
  const dueLabel = useMemo(
    () => action.due_by.toFormat("MMM d"),
    [action.due_by]
  );

  return (
    <div className="flex items-start gap-2.5">
      <ActionStatusIcon status={action.status} className="mt-0.5" />
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm leading-snug",
            isCompleted && "text-muted-foreground line-through"
          )}
        >
          {action.body}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Due {dueLabel}</p>
      </div>
    </div>
  );
}
