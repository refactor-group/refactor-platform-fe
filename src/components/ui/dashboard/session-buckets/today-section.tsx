"use client";

import { useMemo } from "react";
import { DateTime } from "ts-luxon";
import { SessionRow } from "@/components/ui/dashboard/coaching-sessions-row";
import {
  CoachingSessionInclude,
  useEnrichedCoachingSessionsForUser,
} from "@/lib/api/coaching-sessions";
import { CoachingSessionBuckets } from "@/lib/utils/session";
import { CoachingSessionBucketView } from "@/types/coaching-session-bucket";
import {
  isPastSession,
  type EnrichedCoachingSession,
} from "@/types/coaching-session";
import type { Id } from "@/types/general";

export interface TodaySectionProps {
  view: CoachingSessionBucketView;
  /** Frozen anchor — drives the fetch range (viewer-local calendar day)
   *  so SWR doesn't refetch every minute. */
  mountNow: DateTime;
  /** Ticking now — drives the past/future cutoff so a session migrates
   *  between Upcoming/Today and Previous/Today the moment its duration
   *  elapses. */
  now: DateTime;
  userId: Id;
  relationshipId: Id | undefined;
  viewerId: Id;
  userTimezone: string;
  selectedId: Id | undefined;
  onSelect: (session: EnrichedCoachingSession) => void;
  onReschedule: (session: EnrichedCoachingSession) => void;
  onRequestDelete: (session: EnrichedCoachingSession) => void;
  onSeriesAction: (action: "view" | "edit" | "delete", seriesId: Id) => void;
}

const SESSION_INCLUDES: CoachingSessionInclude[] = [
  CoachingSessionInclude.Relationship,
  CoachingSessionInclude.Goal,
];

export function TodaySection({
  view,
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
  onSeriesAction,
}: TodaySectionProps) {
  const isPastView = view === CoachingSessionBucketView.Previous;

  const range = useMemo(
    () => CoachingSessionBuckets.todayRange(mountNow, userTimezone),
    [mountNow, userTimezone]
  );

  // BE sort: ascending for Upcoming (soonest first), descending for
  // Previous (most recent first). The FE filter below preserves order.
  // `tz` shifts BE date boundaries to the viewer's local day — without it, cross-midnight sessions fall out.
  const { enrichedSessions } = useEnrichedCoachingSessionsForUser(
    userId,
    range.start,
    range.end,
    SESSION_INCLUDES,
    "date",
    isPastView ? "desc" : "asc",
    relationshipId,
    userTimezone
  );

  const visibleSessions = useMemo(() => {
    const all = enrichedSessions ?? [];
    return isPastView
      ? all.filter((s) => isPastSession(s, { now }))
      : all.filter((s) => !isPastSession(s, { now }));
  }, [enrichedSessions, isPastView, now]);

  const emptyMessage = isPastView
    ? "No previous sessions from today."
    : "No upcoming sessions scheduled for today.";

  return (
    <section
      aria-label="Today"
      className="group mx-3 mb-4 rounded-md border-[0.5px] border-border"
    >
      <p className="px-3 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60 transition-colors group-hover:text-muted-foreground">
        Today
      </p>
      {visibleSessions.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground/60">
          {emptyMessage}
        </p>
      ) : (
        <div className="px-3 divide-y">
          {visibleSessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              viewerId={viewerId}
              userTimezone={userTimezone}
              isPast={isPastView}
              isSelected={selectedId === session.id}
              onSelect={() => onSelect(session)}
              onReschedule={onReschedule}
              onRequestDelete={onRequestDelete}
              onSeriesAction={onSeriesAction}
            />
          ))}
        </div>
      )}
    </section>
  );
}
