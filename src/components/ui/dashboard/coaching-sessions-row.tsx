"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DateTime } from "ts-luxon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/lib/utils";
import { formatDateWithTime } from "@/lib/utils/date";
import { getSessionParticipantInfo } from "@/lib/utils/session";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { userSessionFirstLastLettersToString } from "@/types/user-session";

export interface SessionRowProps {
  session: EnrichedCoachingSession;
  viewerId: Id;
  userTimezone: string;
  isPast: boolean;
  isHovered: boolean;
  onHover: (id: Id | undefined) => void;
  onReschedule: (session: EnrichedCoachingSession) => void;
}

export function SessionRow({
  session,
  viewerId,
  userTimezone,
  isPast,
  isHovered,
  onHover,
  onReschedule,
}: SessionRowProps) {
  const participant = useMemo(
    () => getSessionParticipantInfo(session, viewerId),
    [session, viewerId]
  );

  const showReschedule = !isPast && participant?.isCoach === true;
  const participantName = participant?.participantName ?? "Unknown";
  const participantInitials = participant
    ? userSessionFirstLastLettersToString(
        participant.firstName,
        participant.lastName
      )
    : "?";
  const dateLabel = useMemo(() => {
    // Backend returns naive ISO strings (no zone suffix) — interpret as UTC
    // before converting to the user's timezone, matching the canonical pattern
    // in `formatSessionTime` (src/lib/utils/session.ts).
    const dt = DateTime.fromISO(session.date, { zone: "utc" }).setZone(
      userTimezone
    );
    return formatDateWithTime(dt, "·");
  }, [session.date, userTimezone]);

  return (
    <div
      className={cn(
        "flex items-center justify-between py-4 group transition-colors rounded-md -mx-2 px-2",
        isHovered && "bg-muted/40"
      )}
      onMouseEnter={() => onHover(session.id)}
      data-testid={`session-row-${session.id}`}
    >
      <div className="flex gap-3 items-center min-w-0 flex-1">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
            {participantInitials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {/* `text-[13px] font-medium text-foreground` mirrors GoalRow in the
              GoalsOverviewCard — the equivalent row primary-text style. */}
          <p className="text-[13px] font-medium text-foreground truncate">
            {participantName}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums truncate mt-0.5">
            {dateLabel}
          </p>
        </div>
      </div>

      {/* Hover-revealed actions are desktop-only; touch devices can't trigger
          hover, so on mobile we hide them entirely and the user navigates by
          tapping the link below (Join/View). `h-8 text-xs` matches the
          UpcomingSessionCard footer button sizing. */}
      <div className="hidden sm:flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {showReschedule && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => onReschedule(session)}
          >
            Reschedule
          </Button>
        )}
        <Link href={`/coaching-sessions/${session.id}`}>
          <Button
            variant={isPast ? "outline" : "default"}
            size="sm"
            className="text-xs h-8"
          >
            {isPast ? "View" : "Join"}
          </Button>
        </Link>
      </div>

      {/* Mobile-only always-visible affordance — touch users get a tap target
          without needing hover. */}
      <Link
        href={`/coaching-sessions/${session.id}`}
        className="sm:hidden shrink-0"
      >
        <Button
          variant={isPast ? "outline" : "default"}
          size="sm"
          className="text-xs h-8"
        >
          {isPast ? "View" : "Join"}
        </Button>
      </Link>
    </div>
  );
}
