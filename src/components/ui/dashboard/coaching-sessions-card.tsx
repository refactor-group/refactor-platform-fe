"use client";

import { useMemo, useState } from "react";
import { DateTime } from "ts-luxon";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CoachingSessionsCardHeader } from "@/components/ui/dashboard/coaching-sessions-card-header";
import {
  SessionTimeWindow,
  TIME_WINDOW_DURATIONS,
  type RelationshipOption,
} from "@/components/ui/dashboard/coaching-sessions-filters";
import { CoachingSessionsListView } from "@/components/ui/dashboard/coaching-sessions-list-view";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useEnrichedCoachingSessionsForUser } from "@/lib/api/coaching-sessions";
import { useUserActionsList } from "@/lib/api/user-actions";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import {
  CoachingSessionInclude,
  type CoachingSession,
  type EnrichedCoachingSession,
} from "@/types/coaching-session";
import {
  isUserCoachInRelationship,
  isUserCoacheeInRelationship,
  sortRelationshipsByParticipantName,
} from "@/types/coaching-relationship";
import { type Id } from "@/types/general";
import { UserActionsScope } from "@/types/assigned-actions";

const ENRICHMENT_INCLUDES = [
  CoachingSessionInclude.Relationship,
  CoachingSessionInclude.Goal,
];

export interface CoachingSessionsCardProps {
  /** Opens the create/edit dialog with the given session pre-filled. */
  onReschedule: (session: CoachingSession | EnrichedCoachingSession) => void;
  /** Notify the parent so it can refresh sibling cards (e.g. UpcomingSessionCard). */
  onSessionDeleted?: () => void;
}

/**
 * Coaching Sessions card — replaces the legacy `CoachingSessionList`.
 *
 * Scoped to the *current user* across all of their relationships. Both tabs
 * are driven by the same universal hook (`useEnrichedCoachingSessionsForUser`)
 * with mirrored windows around `now` — Upcoming asc, Previous desc — sized by
 * the user-selected time-window filter.
 */
export function CoachingSessionsCard({
  onReschedule,
}: CoachingSessionsCardProps) {
  const userSession = useAuthStore((s) => s.userSession);
  const userId = userSession?.id;
  const { currentOrganizationId } = useCurrentOrganization();

  // ── Filter state ─────────────────────────────────────────────────────
  const [timeWindow, setTimeWindow] = useState<SessionTimeWindow>(
    SessionTimeWindow.Day
  );
  const [relationshipFilter, setRelationshipFilter] = useState<Id | undefined>(
    undefined
  );

  // Build the relationship options (mirrors the pattern in
  // ActionsPageContainer): only the user's own relationships, alphabetized
  // by counterpart name, labeled "Coach → Coachee" with "You" inserted.
  const { relationships } = useCoachingRelationshipList(currentOrganizationId);
  const relationshipOptions = useMemo<RelationshipOption[]>(() => {
    if (!relationships || !userId) return [];
    const userRelationships = relationships.filter(
      (r) => r.coach_id === userId || r.coachee_id === userId
    );
    return sortRelationshipsByParticipantName(userRelationships, userId).map(
      (r) => {
        const coachLabel = isUserCoachInRelationship(userId, r)
          ? "You"
          : `${r.coach_first_name} ${r.coach_last_name}`;
        const coacheeLabel = isUserCoacheeInRelationship(userId, r)
          ? "You"
          : `${r.coachee_first_name} ${r.coachee_last_name}`;
        return { id: r.id, label: `${coachLabel} → ${coacheeLabel}` };
      }
    );
  }, [relationships, userId]);

  const selectedRelationshipLabel = relationshipFilter
    ? relationshipOptions.find((r) => r.id === relationshipFilter)?.label
    : undefined;

  // ── Date window — symmetric around `now`, sized by the time-window filter ─
  // The fetch matches the displayed window (no over-fetching). For the OLDEST
  // session in the list, the helper's prior-session lookup will fall back to
  // `previousFromDate` so it never shows actions due before the user's selection.
  const now = useMemo(() => DateTime.now(), []);
  const windowDuration = TIME_WINDOW_DURATIONS[timeWindow];
  const upcomingFromDate = now;
  const upcomingToDate = useMemo(
    () => now.plus(windowDuration),
    [now, windowDuration]
  );
  const previousFromDate = useMemo(
    () => now.minus(windowDuration),
    [now, windowDuration]
  );
  const previousToDate = now;

  const {
    enrichedSessions: upcomingSessions,
    isLoading: upcomingLoading,
    isError: upcomingError,
  } = useEnrichedCoachingSessionsForUser(
    userId ?? null,
    upcomingFromDate,
    upcomingToDate,
    ENRICHMENT_INCLUDES,
    "date",
    "asc",
    relationshipFilter
  );

  const {
    enrichedSessions: previousSessions,
    isLoading: previousLoading,
    isError: previousError,
  } = useEnrichedCoachingSessionsForUser(
    userId ?? null,
    previousFromDate,
    previousToDate,
    ENRICHMENT_INCLUDES,
    "date",
    "desc",
    relationshipFilter
  );

  // Session-scoped actions for the user — narrowed to the chosen relationship
  // when the filter is set, so hover-panel "actions due" stays consistent.
  const { actions: allActions } = useUserActionsList(
    userId ?? null,
    {
      scope: UserActionsScope.Sessions,
      ...(relationshipFilter && {
        coaching_relationship_id: relationshipFilter,
      }),
    }
  );

  const isLoading = upcomingLoading || previousLoading;
  const isError = !!upcomingError || !!previousError;

  return (
    <TooltipProvider delayDuration={200}>
      {/* `md:h-[360px]` is a *fixed* height (~50% taller than the two cards
          above) — the card never grows past it. Both inner viewports (left
          list and right hover panel) scroll internally when their content
          overflows, so the dashboard's vertical rhythm stays stable
          regardless of how many sessions or actions there are. On smaller
          screens the upper cards stack and grow with content, so we let this
          one auto-size to match. */}
      <Card className="border shadow-none flex flex-col md:h-[360px] overflow-hidden">
        <CardContent className="p-0 flex flex-col flex-1 min-h-0">
          <CoachingSessionsCardHeader
            timeWindow={timeWindow}
            onTimeWindowChange={setTimeWindow}
            relationshipFilter={relationshipFilter}
            onRelationshipFilterChange={setRelationshipFilter}
            relationshipOptions={relationshipOptions}
            selectedRelationshipLabel={selectedRelationshipLabel}
          />

          {!userSession || isLoading ? (
            <StateLoading />
          ) : isError ? (
            <StateError />
          ) : (
            <CoachingSessionsListView
              upcomingSessions={upcomingSessions}
              previousSessions={previousSessions}
              allActions={allActions}
              viewerId={userSession.id}
              userTimezone={userSession.timezone || getBrowserTimezone()}
              fallbackPriorSessionDate={previousFromDate}
              onReschedule={onReschedule}
            />
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// ── Inline states (small enough to keep with the orchestrator) ──────────

function StateLoading() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[160px] gap-2 py-8">
      <Spinner />
      <p className="text-xs text-muted-foreground">
        Loading your coaching sessions…
      </p>
    </div>
  );
}

function StateError() {
  return (
    <div className="flex items-center justify-center flex-1 min-h-[160px] py-8">
      <p className="text-sm text-destructive">
        Couldn&apos;t load your coaching sessions. Please refresh.
      </p>
    </div>
  );
}
