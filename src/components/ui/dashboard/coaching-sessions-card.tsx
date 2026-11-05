"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { DateTime } from "ts-luxon";
import { useSWRConfig } from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CoachingSessionsCardHeader,
  type RelationshipOption,
} from "@/components/ui/dashboard/coaching-sessions-card-header";
import { BucketsContainer } from "@/components/ui/dashboard/session-buckets/buckets-container";
import { SessionActionDialogs } from "@/components/ui/dashboard/session-action-dialogs";
import { useSessionActions } from "@/components/ui/dashboard/use-session-actions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingSessionsCardFilterStore } from "@/lib/providers/coaching-sessions-card-filter-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { USERS_BASEURL } from "@/lib/api/users";
import type { MoveScope } from "@/lib/scheduling";
import { SessionAction } from "@/lib/session-actions";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import {
  type EnrichedCoachingSession,
} from "@/types/coaching-session";
import {
  isUserCoachInRelationship,
  isUserCoacheeInRelationship,
  sortRelationshipsByParticipantName,
} from "@/types/coaching-relationship";

const matchesUserSessionsCache = (key: unknown): boolean => {
  const url =
    typeof key === "string"
      ? key
      : Array.isArray(key) && typeof key[0] === "string"
        ? key[0]
        : null;
  return url !== null && url.includes(USERS_BASEURL);
};

export interface CoachingSessionsCardProps {
  /** Opens the New session dialog to move the given session, this one only by default. */
  onReschedule: (session: EnrichedCoachingSession, scope?: MoveScope) => void;
  /** Surfaces the card's SWR `refresh()` so the parent can revalidate it
   *  after a series changes elsewhere. Mirrors `UpcomingSessionCard.onRefreshNeeded`. */
  onRefreshNeeded?: (refresh: () => void) => void;
  /** Fires after a series is deleted from a session row's
   *  kebab. Re-materialization changes future sessions across surfaces, so
   *  the parent uses this to refresh sibling cards (e.g. UpcomingSession).
   *  The card already revalidates its own buckets internally. */
  onSeriesMutated?: () => void;
  /** Formats dates in the session detail. */
  locale: string;
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
  onRefreshNeeded,
  onSeriesMutated,
  locale,
}: CoachingSessionsCardProps) {
  const userSession = useAuthStore((s) => s.userSession);
  const userId = userSession?.id;
  const userTimezone = userSession?.timezone || getBrowserTimezone();
  const { currentOrganizationId } = useCurrentOrganization();
  const { mutate } = useSWRConfig();

  // Persisted in sessionStorage via the dedicated card filter store, so the
  // user's last-used relationship filter survives navigation away from the
  // dashboard and reloads within the same browser tab session.
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

  // `mountNow` is frozen at the card's mount so it drives the bucket grid
  // and pinned-week ranges deterministically across re-renders. Per the
  // BE counts contract, this anchor — and the `tz` it pairs with — control
  // local-calendar alignment of bucket boundaries with response month keys.
  const mountNow = useMemo(() => DateTime.now(), []);

  // Manual invalidation for user-scoped session caches. `useEntityMutation`'s
  // built-in invalidator matches keys by baseUrl string membership only, but
  // `useEntityList`'s SWR keys are tuples `[url, params]` — so the user-scoped
  // bucket / pinned / counts fetches need a tuple-aware matcher to revalidate
  // after create / edit / delete.
  const refreshBucketData = useCallback(() => {
    mutate(matchesUserSessionsCache);
  }, [mutate]);

  const refreshBucketDataRef = useRef(refreshBucketData);
  useEffect(() => {
    refreshBucketDataRef.current = refreshBucketData;
  });
  useEffect(() => {
    onRefreshNeeded?.(() => refreshBucketDataRef.current());
  }, [onRefreshNeeded]);

  const actions = useSessionActions({
    userTimezone,
    onReschedule,
    onSessionsChanged: refreshBucketData,
    onSeriesMutated,
  });
  const { run } = actions;
  const bucketActions = useMemo(
    () => ({
      onReschedule: (session: EnrichedCoachingSession) =>
        run(SessionAction.Reschedule, session),
      onEditSeries: (session: EnrichedCoachingSession) =>
        run(SessionAction.EditSeries, session),
      onRequestDelete: (session: EnrichedCoachingSession) =>
        run(SessionAction.DeleteSession, session),
      onRequestResendInvite: (session: EnrichedCoachingSession) =>
        run(SessionAction.ResendInvite, session),
    }),
    [run]
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
            relationshipFilter={relationshipFilter}
            onRelationshipFilterChange={setRelationshipFilter}
            relationshipOptions={relationshipOptions}
          />

          {/* Waits for the organization: mounting before it resolves fetches and
              briefly renders every organization's sessions. */}
          {userSession && userId && currentOrganizationId && (
            <BucketsContainer
              userId={userId}
              relationshipFilter={relationshipFilter}
              organizationId={currentOrganizationId}
              viewerId={userSession.id}
              userTimezone={userTimezone}
              locale={locale}
              mountNow={mountNow}
              {...bucketActions}
              onSeriesAction={actions.openSeries}
            />
          )}
        </CardContent>
      </Card>
      <SessionActionDialogs {...actions.dialogs} />
    </TooltipProvider>
  );
}

