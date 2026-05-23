"use client";

import { useMemo } from "react";
import { DateTime } from "ts-luxon";
import { SessionRow } from "@/components/ui/dashboard/coaching-sessions-row";
import {
  CoachingSessionInclude,
  useEnrichedCoachingSessionsForUser,
} from "@/lib/api/coaching-sessions";
import { CoachingSessionBuckets } from "@/lib/utils/session";
import { CoachingSessionBucketKind } from "@/types/coaching-session-bucket";
import {
  isPastSession,
  type EnrichedCoachingSession,
} from "@/types/coaching-session";
import type { Id } from "@/types/general";

export interface PinnedWeekSectionProps {
  kind: CoachingSessionBucketKind;
  mountNow: DateTime;
  /** Ticking "now" — drives the past/future cutoff for the upcoming
   *  "This Week" view so sessions migrate out as they end. */
  now: DateTime;
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
  now,
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

  // "This Week" filters out past sessions — the calendar-week endpoints
  // stay anchored Sun–Sat, but the past/future cutoff inside that window
  // tracks `now`. So a session earlier in this week drops out once it
  // has fully elapsed. "Last Week" is past by construction.
  const visibleSessions = useMemo(() => {
    const all = enrichedSessions ?? [];
    return isUpcoming ? all.filter((s) => !isPastSession(s, { now })) : all;
  }, [enrichedSessions, isUpcoming, now]);

  const label = isUpcoming ? "This Week" : "Last Week";
  const emptyMessage = isUpcoming
    ? "No upcoming sessions this week."
    : "No sessions last week.";

  return (
    <section aria-label={label}>
      <p className="px-6 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
        {label}
      </p>
      {visibleSessions.length === 0 ? (
        <p className="px-6 py-3 text-sm text-muted-foreground/60">
          {emptyMessage}
        </p>
      ) : (
        <div className="px-6 divide-y">
          {visibleSessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              viewerId={viewerId}
              userTimezone={userTimezone}
              isPast={!isUpcoming}
              isSelected={selectedId === session.id}
              onSelect={() => onSelect(session)}
              onReschedule={onReschedule}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
