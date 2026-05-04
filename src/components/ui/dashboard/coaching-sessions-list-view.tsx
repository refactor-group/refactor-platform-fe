"use client";

import { useCallback, useMemo } from "react";
import { type DateTime } from "ts-luxon";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { SessionHoverDetail } from "@/components/ui/dashboard/coaching-sessions-hover-detail";
import { SessionRow } from "@/components/ui/dashboard/coaching-sessions-row";
import { selectReviewActionsForSession } from "@/lib/utils/select-review-actions-for-session";
import { getSessionParticipantInfo } from "@/lib/utils/session";
import type { Action } from "@/types/action";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";

export interface CoachingSessionsListViewProps {
  upcomingSessions: EnrichedCoachingSession[];
  previousSessions: EnrichedCoachingSession[];
  allActions: Action[];
  viewerId: Id;
  userTimezone: string;
  /** Lower bound on the action-due window when no prior session is in view —
   *  matches the user's selected display window so the oldest session never
   *  shows actions due before that. */
  fallbackPriorSessionDate: DateTime;
  /** Currently hovered session, owned by the parent so the action fetch can
   *  be keyed on the hovered session's `coaching_relationship_id`. Undefined
   *  when nothing is hovered. */
  hoveredSession: EnrichedCoachingSession | undefined;
  /** Notifies the parent of hover changes (or clears with `undefined`). */
  onHoverChange: (id: Id | undefined) => void;
  onReschedule: (session: EnrichedCoachingSession) => void;
}

export function CoachingSessionsListView({
  upcomingSessions,
  previousSessions,
  allActions,
  viewerId,
  userTimezone,
  fallbackPriorSessionDate,
  hoveredSession,
  onHoverChange,
  onReschedule,
}: CoachingSessionsListViewProps) {
  // Combined list is needed for the helper's prev-session lookup within the
  // hovered session's relationship.
  const allSessions = useMemo(
    () => [...previousSessions, ...upcomingSessions],
    [previousSessions, upcomingSessions]
  );

  const hoveredParticipant = useMemo(
    () =>
      hoveredSession
        ? getSessionParticipantInfo(hoveredSession, viewerId)
        : null,
    [hoveredSession, viewerId]
  );

  const hoveredReviewActions = useMemo(
    () =>
      hoveredSession
        ? selectReviewActionsForSession(
            allActions,
            allSessions,
            hoveredSession.id,
            fallbackPriorSessionDate
          )
        : [],
    [allActions, allSessions, hoveredSession, fallbackPriorSessionDate]
  );

  const clearHover = useCallback(() => onHoverChange(undefined), [onHoverChange]);
  const hoveredSessionId = hoveredSession?.id;

  return (
    <div
      className="flex flex-col md:flex-row flex-1 min-h-0"
      onMouseLeave={clearHover}
    >
      {/* Left: tabbed session list */}
      <Tabs defaultValue="upcoming" className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="px-6 shrink-0">
          <TabsList className="h-8 p-0.5 w-auto">
            <TabsTrigger value="upcoming" className="text-xs h-7 px-3">
              Upcoming
            </TabsTrigger>
            <TabsTrigger value="previous" className="text-xs h-7 px-3">
              Previous
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Each TabsContent gets `flex-1 min-h-0` so the inner scroll
            container can constrain to the remaining card-body height. */}
        <TabsContent value="upcoming" className="mt-2 flex-1 min-h-0">
          <SessionListColumn
            sessions={upcomingSessions}
            viewerId={viewerId}
            userTimezone={userTimezone}
            isPast={false}
            hoveredId={hoveredSessionId}
            onHover={onHoverChange}
            onReschedule={onReschedule}
          />
        </TabsContent>

        <TabsContent value="previous" className="mt-2 flex-1 min-h-0">
          <SessionListColumn
            sessions={previousSessions}
            viewerId={viewerId}
            userTimezone={userTimezone}
            isPast={true}
            hoveredId={hoveredSessionId}
            onHover={onHoverChange}
            onReschedule={onReschedule}
          />
        </TabsContent>
      </Tabs>

      {/* Vertical divider */}
      <div className="hidden md:block w-px bg-border shrink-0" />

      {/* Right: hover detail — `min-h-0 + overflow-y-auto` lets it scroll
          internally instead of growing the card. Padding mirrors
          `UpcomingSessionCard` (`p-4 sm:p-6`) so the same content type reads
          with the same breathing room across the dashboard. */}
      <div className="hidden md:flex flex-col flex-1 min-w-0 min-h-0 p-4 sm:p-6 gap-4 overflow-y-auto">
        <SessionHoverDetail
          session={hoveredSession}
          participantName={hoveredParticipant?.participantName ?? ""}
          reviewActions={hoveredReviewActions}
        />
      </div>

      <div className="h-4 md:hidden" />
    </div>
  );
}

// ── Session list column (one per tab) ───────────────────────────────────

interface SessionListColumnProps {
  sessions: EnrichedCoachingSession[];
  viewerId: Id;
  userTimezone: string;
  isPast: boolean;
  hoveredId: Id | undefined;
  onHover: (id: Id | undefined) => void;
  onReschedule: (session: EnrichedCoachingSession) => void;
}

function SessionListColumn({
  sessions,
  viewerId,
  userTimezone,
  isPast,
  hoveredId,
  onHover,
  onReschedule,
}: SessionListColumnProps) {
  if (sessions.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-sm text-muted-foreground/60">
        No {isPast ? "previous" : "upcoming"} sessions.
      </div>
    );
  }

  return (
    <div className="px-6 h-full overflow-y-auto divide-y">
      {sessions.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          viewerId={viewerId}
          userTimezone={userTimezone}
          isPast={isPast}
          isHovered={hoveredId === session.id}
          onHover={onHover}
          onReschedule={onReschedule}
        />
      ))}
    </div>
  );
}
