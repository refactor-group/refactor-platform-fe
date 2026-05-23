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
  hoveredId: Id | undefined;
  onHover: (session: EnrichedCoachingSession) => void;
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
  hoveredId,
  onHover,
  onReschedule,
  onRequestDelete,
}: PinnedWeekSectionProps) {
  const range = useMemo(
    () =>
      kind === CoachingSessionBucketKind.Future
        ? CoachingSessionBuckets.currentWeekRange(mountNow)
        : CoachingSessionBuckets.previousWeekRange(mountNow),
    [kind, mountNow]
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

  if (!enrichedSessions || enrichedSessions.length === 0) {
    return null;
  }

  const label =
    kind === CoachingSessionBucketKind.Future ? "This Week" : "Last Week";

  return (
    <section aria-label={label}>
      <p className="px-6 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
        {label}
      </p>
      <div className="px-6 divide-y">
        {enrichedSessions.map((session) => {
          const rowIsPast =
            kind === CoachingSessionBucketKind.Past ||
            calculateSessionUrgency(session) === SessionUrgency.Past;
          return (
            <SessionRow
              key={session.id}
              session={session}
              viewerId={viewerId}
              userTimezone={userTimezone}
              isPast={rowIsPast}
              isHovered={hoveredId === session.id}
              onHover={() => onHover(session)}
              onReschedule={onReschedule}
              onRequestDelete={onRequestDelete}
            />
          );
        })}
      </div>
    </section>
  );
}
