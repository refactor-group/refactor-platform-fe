"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { DateTime } from "ts-luxon";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PulsingDot } from "@/components/ui/pulsing-dot";
import { SessionGoalList } from "@/components/ui/session-goal-list";
import { UpcomingSessionCardEmpty } from "@/components/ui/dashboard/upcoming-session-card-empty";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useTodaysSessions } from "@/lib/hooks/use-todays-sessions";
import { useAssignedActions } from "@/lib/hooks/use-assigned-actions";
import {
  calculateSessionUrgency,
  countActionsDueBySession,
  formatSessionTime,
  getSessionParticipantInfo,
  getUrgencyMessage,
  selectNextUpcomingSession,
} from "@/lib/utils/session";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import { userSessionFirstLastLettersToString } from "@/types/user-session";
import {
  DEFAULT_SESSION_DURATION_MINUTES,
  type EnrichedCoachingSession,
} from "@/types/coaching-session";
import { SessionUrgency } from "@/types/session-display";
import type { AssignedActionWithContext } from "@/types/assigned-actions";

/**
 * Props for UpcomingSessionCard.
 */
interface UpcomingSessionCardProps {
  /** Invoked with no args when the user clicks Schedule a coaching session
   *  from the empty state. Required because the empty state is reachable
   *  whenever there is no non-past session today. */
  onCreateSession: () => void;
  /** Invoked with the selected session when the user clicks Reschedule. */
  onReschedule?: (session: EnrichedCoachingSession) => void;
  /** Surfaces the internal hook's refresh function to the parent so it can
   *  force a refresh after a dialog closes. */
  onRefreshNeeded?: (refresh: () => void) => void;
}

/**
 * UpcomingSessionCard
 *
 * Dashboard surface showing the user's next non-past coaching session today
 * — or an empty-state invitation to schedule one when nothing remains.
 * Owns its own data fetch via useTodaysSessions; selects a single session
 * via selectNextUpcomingSession; and renders one of four inline states
 * (loading / error / populated / empty).
 */
export function UpcomingSessionCard({
  onCreateSession,
  onReschedule,
  onRefreshNeeded,
}: UpcomingSessionCardProps) {
  const { userSession, isACoach } = useAuthStore((state) => state);
  const { sessions, isLoading, error, refresh } = useTodaysSessions();
  const { flatActions } = useAssignedActions();

  // Surface refresh to parent (e.g. DashboardContainer) so it can force a
  // re-fetch after the create/edit dialog closes.
  useEffect(() => {
    onRefreshNeeded?.(refresh);
  }, [onRefreshNeeded, refresh]);

  // During the brief auth hydration race, render the loading chrome rather
  // than an empty slot — keeps the dashboard layout stable.
  if (!userSession || isLoading) {
    return <CardContainer><StateLoading /></CardContainer>;
  }

  if (error) {
    return <CardContainer><StateError /></CardContainer>;
  }

  const nextSession = selectNextUpcomingSession(sessions);

  if (!nextSession) {
    return (
      <CardContainer>
        <UpcomingSessionCardEmpty
          onCreateSession={onCreateSession}
          canCreateSession={isACoach}
        />
      </CardContainer>
    );
  }

  return (
    <CardContainer>
      <PopulatedBody
        session={nextSession}
        userId={userSession.id}
        userTimezone={userSession.timezone || getBrowserTimezone()}
        assignedActions={flatActions}
        onReschedule={onReschedule}
      />
    </CardContainer>
  );
}

// ── Card container ──────────────────────────────────────────────────────

function CardContainer({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border shadow-none h-full flex flex-col">
      <CardContent className="p-4 sm:p-6 flex flex-col flex-1 gap-4">
        {children}
      </CardContent>
    </Card>
  );
}

// ── Loading / error inline states ──────────────────────────────────────

function StateLoading() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center gap-2 py-4">
      <Spinner />
      <p className="text-xs text-muted-foreground">Loading your upcoming session…</p>
    </div>
  );
}

function StateError() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center py-4">
      <p className="text-sm text-destructive">
        Couldn&apos;t load your upcoming session. Please refresh.
      </p>
    </div>
  );
}

// ── Populated body ──────────────────────────────────────────────────────

interface PopulatedBodyProps {
  session: EnrichedCoachingSession;
  userId: string;
  userTimezone: string;
  assignedActions: AssignedActionWithContext[];
  onReschedule?: (session: EnrichedCoachingSession) => void;
}

function PopulatedBody({
  session,
  userId,
  userTimezone,
  assignedActions,
  onReschedule,
}: PopulatedBodyProps) {
  const participant = getSessionParticipantInfo(session, userId);
  if (!participant) return null;

  const timeStr = formatSessionTime(session.date, userTimezone);
  const urgency = calculateSessionUrgency(session);
  const urgencyMessage = getUrgencyMessage(session, urgency, userTimezone);
  const showPulsingDot =
    urgency === SessionUrgency.Imminent || urgency === SessionUrgency.Underway;

  const actionsDueCount = countActionsDueBySession(
    assignedActions,
    session.coaching_relationship_id,
    DateTime.fromISO(session.date),
  );
  const initials = userSessionFirstLastLettersToString(
    participant.firstName,
    participant.lastName,
  );

  return (
    <>
      <HeaderRow
        participantName={participant.participantName}
        timeStr={timeStr}
      />

      <ParticipantRow initials={initials} actionsDueCount={actionsDueCount} />

      <SessionGoalList goals={session.goals ?? []} />

      <FooterRow
        urgencyMessage={urgencyMessage}
        showPulsingDot={showPulsingDot}
        showReschedule={participant.isCoach}
        onReschedule={onReschedule ? () => onReschedule(session) : undefined}
        sessionId={session.id}
      />
    </>
  );
}

// ── Sub-rows ────────────────────────────────────────────────────────────

function HeaderRow({
  participantName,
  timeStr,
}: {
  participantName: string;
  timeStr: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60 truncate">
          Upcoming session
        </p>
        <h3 className="text-base font-semibold text-foreground mt-1 truncate">
          Session with {participantName}
        </h3>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
          {timeStr}
        </span>
        <span className="text-[11px] text-muted-foreground/60 tabular-nums whitespace-nowrap">
          {DEFAULT_SESSION_DURATION_MINUTES} min
        </span>
      </div>
    </div>
  );
}

function ParticipantRow({
  initials,
  actionsDueCount,
}: {
  initials: string;
  actionsDueCount: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm text-muted-foreground">
        {actionsDueCount} {actionsDueCount === 1 ? "action" : "actions"} due
      </span>
    </div>
  );
}

function FooterRow({
  urgencyMessage,
  showPulsingDot,
  showReschedule,
  onReschedule,
  sessionId,
}: {
  urgencyMessage: string;
  showPulsingDot: boolean;
  showReschedule: boolean;
  onReschedule?: () => void;
  sessionId: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-auto pt-4 border-t">
      <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0 sm:flex-1">
        {showPulsingDot && <PulsingDot className="h-1.5 w-1.5" />}
        <span className="truncate">{urgencyMessage}</span>
      </div>
      <div className="flex gap-1.5 shrink-0 sm:self-auto self-end">
        {showReschedule && onReschedule && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={onReschedule}
          >
            Reschedule
          </Button>
        )}
        <Link href={`/coaching-sessions/${sessionId}`}>
          <Button size="sm" className="h-8 text-xs">Join</Button>
        </Link>
      </div>
    </div>
  );
}

