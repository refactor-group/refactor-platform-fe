"use client";

import { DateTime } from "ts-luxon";
import { MessageSquare } from "lucide-react";
import { SessionGoalList } from "@/components/ui/session-goal-list";
import { ActionStatusRow } from "@/components/ui/status/action-status-row";
import { PanelSection } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";
import { useActionMutation } from "@/lib/api/actions";
import { useRevalidateGoalProgress } from "@/lib/api/goal-progress";
import { toast } from "@/lib/toast";
import { actionErrorMessage } from "@/lib/utils/action-error-message";
import { formatDateWithTime } from "@/lib/utils/date";
import type { Action } from "@/types/action";
import type { ItemStatus } from "@/types/general";
import {
  isPastSession,
  type EnrichedCoachingSession,
} from "@/types/coaching-session";
import { CoachingSessionTitleText } from "@/components/ui/coaching-session-title-text";

export interface SessionHoverDetailProps {
  session: EnrichedCoachingSession;
  participantName: string;
  userTimezone: string;
  reviewActions: Action[];
  locale: string;
}

export function SessionHoverDetailEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <MessageSquare className="h-8 w-8 text-muted-foreground/20 mb-3" />
      <p className="text-sm text-muted-foreground/40">
        Click a session to see actions due
      </p>
    </div>
  );
}

export function SessionHoverDetail({
  session,
  participantName,
  userTimezone,
  reviewActions,
  locale,
}: SessionHoverDetailProps) {
  const setStatus = useSetActionStatus();
  const goals = session.goals ?? [];
  const scheduledDateTime = DateTime.fromISO(session.date, {
    zone: "utc",
  }).setZone(userTimezone);
  const scheduledPrefix = isPastSession(session) ? "Held" : "Scheduled for";
  const scheduledLabel = `${scheduledPrefix} ${formatDateWithTime(scheduledDateTime, "·", true)} · ${session.duration_minutes} min`;

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
        <CoachingSessionTitleText
          session={session}
          hideWhenFallback
          hideWhenRedundantWithGoals
          className="text-sm text-muted-foreground mt-0.5"
        />
        <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
          {scheduledLabel}
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
          // `divide-y` + per-row hover/chevron pattern mirrors `GoalRow` in
          // the Goals Overview card so the dashboard's two list surfaces read
          // consistently. Each row links to the session that owns the action
          // with `?panel=actions` so the Actions panel opens automatically.
          <div className="divide-y divide-border/50">
            {reviewActions.map((action) => (
              <ActionDueRow key={action.id} action={action} locale={locale} onStatusChange={setStatus} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** Saves a new status; the action lists and any linked goal's progress refresh after. */
function useSetActionStatus() {
  const { update } = useActionMutation();
  const revalidateGoalProgress = useRevalidateGoalProgress();
  return async (action: Action, status: ItemStatus) => {
    try {
      await update(action.id, { ...action, status });
      if (action.goal_id.some) revalidateGoalProgress();
    } catch (err) {
      toast.error(actionErrorMessage("update the status", err));
    }
  };
}

interface ActionDueRowProps {
  action: Action;
  locale: string;
  onStatusChange: (action: Action, status: ItemStatus) => void;
}

function ActionDueRow({ action, locale, onStatusChange }: ActionDueRowProps) {
  return (
    <ActionStatusRow
      title={action.body ?? ""}
      status={action.status}
      dueBy={action.due_by}
      statusChangedAt={action.status_changed_at}
      href={`/coaching-sessions/${action.coaching_session_id}?panel=${PanelSection.Actions}`}
      locale={locale}
      onStatusChange={(status) => onStatusChange(action, status)}
      className="-mx-3"
    />
  );
}
