"use client";

import { useMemo } from "react";
import { DateTime } from "ts-luxon";
import { SessionRow } from "@/components/ui/dashboard/coaching-sessions-row";
import {
  CoachingSessionInclude,
  useEnrichedCoachingSessionsForUser,
} from "@/lib/api/coaching-sessions";
import {
  CoachingSessionBuckets,
  calculateSessionUrgency,
} from "@/lib/utils/session";
import { CoachingSessionBucketKind } from "@/types/coaching-session-bucket";
import { SessionUrgency } from "@/types/session-display";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";

export interface PinnedWeekSectionProps {
  kind: CoachingSessionBucketKind;
  mountNow: DateTime;
  userId: Id;
  relationshipId: Id | undefined;
  viewerId: Id;
  userTimezone: string;
  selectedId: Id | undefined;
  onSelect: (session: EnrichedCoachingSession) => void;
  onReschedule: (session: EnrichedCoachingSession) => void;
  onRequestDelete: (session: EnrichedCoachingSession) => void;
}

const SESSION_INCLUDES: CoachingSessionInclude[] = [
  CoachingSessionInclude.Relationship,
  CoachingSessionInclude.Goal,
];

export function PinnedWeekSection({
  kind,
  mountNow,
  userId,
  relationshipId,
  viewerId,
  userTimezone,
  selectedId,
  onSelect,
  onReschedule,
  onRequestDelete,
}: PinnedWeekSectionProps) {
  const isUpcoming = kind === CoachingSessionBucketKind.Future;

  const range = useMemo(
    () =>
      isUpcoming
        ? CoachingSessionBuckets.currentWeekRange(mountNow)
        : CoachingSessionBuckets.previousWeekRange(mountNow),
    [isUpcoming, mountNow]
  );

  const { enrichedSessions } = useEnrichedCoachingSessionsForUser(
    userId,
    range.start,
    range.end,
    SESSION_INCLUDES,
    undefined,
    undefined,
    relationshipId
  );

  // Pinned sections are calendar-week spotlights, not upcoming/past
  // filters. "This Week" includes every Sun–Sat session even if some
  // have already happened — the row's own urgency drives the View/Join
  // affordance. "Last Week" is past by construction. The section
  // always renders so its presence is stable across filter changes;
  // an empty week shows a placeholder line.
  const label = isUpcoming ? "This Week" : "Last Week";
  const sessions = enrichedSessions ?? [];

  return (
    <section aria-label={label}>
      <p className="px-6 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
        {label}
      </p>
      {sessions.length === 0 ? (
        <p className="px-6 py-3 text-sm text-muted-foreground/60">
          {isUpcoming ? "No sessions this week." : "No sessions last week."}
        </p>
      ) : (
        <div className="px-6 divide-y">
          {sessions.map((session) => {
          const rowIsPast =
            !isUpcoming ||
            calculateSessionUrgency(session) === SessionUrgency.Past;
          return (
            <SessionRow
              key={session.id}
              session={session}
              viewerId={viewerId}
              userTimezone={userTimezone}
              isPast={rowIsPast}
              isSelected={selectedId === session.id}
              onSelect={() => onSelect(session)}
              onReschedule={onReschedule}
              onRequestDelete={onRequestDelete}
            />
          );
        })}
        </div>
      )}
    </section>
  );
}
