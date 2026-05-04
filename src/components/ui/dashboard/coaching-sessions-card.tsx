"use client";

import { useEffect, useMemo } from "react";
import { DateTime } from "ts-luxon";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CoachingSessionsCardHeader } from "@/components/ui/dashboard/coaching-sessions-card-header";
import {
  TIME_WINDOW_DURATIONS,
  type RelationshipOption,
} from "@/components/ui/dashboard/coaching-sessions-filters";
import { CoachingSessionsListView } from "@/components/ui/dashboard/coaching-sessions-list-view";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingSessionsCardFilterStore } from "@/lib/providers/coaching-sessions-card-filter-store-provider";
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
  // Persisted in sessionStorage via the dedicated card filter store, so the
  // user's last-used time range and relationship filter survive navigation
  // away from the dashboard and reloads within the same browser tab session.
  const timeWindow = useCoachingSessionsCardFilterStore((s) => s.timeWindow);
  const setTimeWindow = useCoachingSessionsCardFilterStore(
    (s) => s.setTimeWindow
  );
  const relationshipFilter = useCoachingSessionsCardFilterStore(
    (s) => s.relationshipFilter
  );
  const setRelationshipFilter = useCoachingSessionsCardFilterStore(
    (s) => s.setRelationshipFilter
  );

  // Build the relationship options (mirrors the pattern in
  // ActionsPageContainer): only the user's own relationships, alphabetized
  // by counterpart name, labeled "Coach → Coachee" with "You" inserted.
  const { relationships, isLoading: isRelationshipsLoading } =
    useCoachingRelationshipList(currentOrganizationId);
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

  // Clear a stale persisted relationship filter once we know the user's
  // current relationship set — covers org switches, removed relationships,
  // and any other case where the saved id no longer resolves to a real
  // option. Gate on `isRelationshipsLoading` because `useEntityList` returns
  // an empty array (not `undefined`) during the SWR pre-fetch window — a
  // truthiness check on `relationships` would silently clear the persisted
  // filter on every mount before the API call resolves.
  useEffect(() => {
    if (isRelationshipsLoading || !relationshipFilter) return;
    const stillExists = relationshipOptions.some(
      (r) => r.id === relationshipFilter
    );
    if (!stillExists) {
      setRelationshipFilter(undefined);
    }
  }, [
    isRelationshipsLoading,
    relationshipFilter,
    relationshipOptions,
    setRelationshipFilter,
  ]);

  const selectedRelationshipLabel = relationshipFilter
    ? relationshipOptions.find((r) => r.id === relationshipFilter)?.label
    : undefined;

  // ── Date window — symmetric around `now`, sized by the time-window filter ─
  // Single fetch over `[now − window, now + window]`, partitioned client-side at
  // full timestamp precision against `now`. This avoids the day-precision overlap
  // a dual-fetch would produce: backend `from_date`/`to_date` are `[from, to]`
  // inclusive at calendar-day precision, so two queries meeting at `now` would
  // both return today's sessions and render them in both tabs.
  const now = useMemo(() => DateTime.now(), []);
  const windowDuration = TIME_WINDOW_DURATIONS[timeWindow];
  const fromDate = useMemo(
    () => now.minus(windowDuration),
    [now, windowDuration]
  );
  const toDate = useMemo(
    () => now.plus(windowDuration),
    [now, windowDuration]
  );

  const {
    enrichedSessions: allSessions,
    isLoading,
    isError,
  } = useEnrichedCoachingSessionsForUser(
    userId ?? null,
    fromDate,
    toDate,
    ENRICHMENT_INCLUDES,
    "date",
    "asc",
    relationshipFilter
  );

  // Sessions starting exactly at `now` belong in Upcoming. Previous is reversed
  // so the most recent session appears first, matching the prior `desc` fetch.
  const { upcomingSessions, previousSessions } = useMemo(() => {
    const upcoming: EnrichedCoachingSession[] = [];
    const previous: EnrichedCoachingSession[] = [];
    for (const session of allSessions) {
      if (DateTime.fromISO(session.date) >= now) {
        upcoming.push(session);
      } else {
        previous.push(session);
      }
    }
    previous.reverse();
    return { upcomingSessions: upcoming, previousSessions: previous };
  }, [allSessions, now]);

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
              fallbackPriorSessionDate={fromDate}
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
