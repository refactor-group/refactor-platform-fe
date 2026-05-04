"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DateTime } from "ts-luxon";
import { toast as sonnerToast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CoachingSessionsCardHeader } from "@/components/ui/dashboard/coaching-sessions-card-header";
import {
  TIME_WINDOW_DURATIONS,
  type RelationshipOption,
} from "@/components/ui/dashboard/coaching-sessions-filters";
import { CoachingSessionsListView } from "@/components/ui/dashboard/coaching-sessions-list-view";
import { DeleteSessionDialog } from "@/components/ui/dashboard/delete-session-dialog";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingSessionsCardFilterStore } from "@/lib/providers/coaching-sessions-card-filter-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import {
  useCoachingSessionMutation,
  useEnrichedCoachingSessionsForUser,
} from "@/lib/api/coaching-sessions";
import { useUserActionsList } from "@/lib/api/user-actions";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import { getSessionParticipantInfo } from "@/lib/utils/session";
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
  /** Surfaces the card's internal SWR `refresh()` to the parent so it can
   *  force a revalidate after a create/edit dialog closes. The
   *  user-scoped enriched fetch uses a tuple SWR key (`[url, params]`),
   *  which `useEntityMutation`'s auto-invalidation skips because it
   *  filters by `typeof key === "string"`. Without this hook-up, newly-
   *  created sessions wouldn't appear in the list until a hard reload.
   *  Mirrors `UpcomingSessionCard.onRefreshNeeded`. */
  onRefreshNeeded?: (refresh: () => void) => void;
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
  //
  // Two distinct "now"s on purpose:
  //   - `mountNow` is frozen at mount and drives `fromDate`/`toDate` so the SWR
  //     fetch key stays stable. Re-deriving it on every tick would refetch the
  //     session list every minute for no benefit.
  //   - `now` ticks every minute and drives the partition so a session whose
  //     start time crosses the boundary while the dashboard is open migrates
  //     from Upcoming to Previous within ≤ 60s. SWR's revalidate-on-focus is
  //     the orthogonal mechanism for picking up *new* sessions.
  const mountNow = useMemo(() => DateTime.now(), []);
  const [now, setNow] = useState(() => DateTime.now());
  useEffect(() => {
    const id = setInterval(() => setNow(DateTime.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const windowDuration = TIME_WINDOW_DURATIONS[timeWindow];
  const fromDate = useMemo(
    () => mountNow.minus(windowDuration),
    [mountNow, windowDuration]
  );
  const toDate = useMemo(
    () => mountNow.plus(windowDuration),
    [mountNow, windowDuration]
  );

  const {
    enrichedSessions: allSessions,
    isLoading,
    isError,
    refresh: refreshSessions,
  } = useEnrichedCoachingSessionsForUser(
    userId ?? null,
    fromDate,
    toDate,
    ENRICHMENT_INCLUDES,
    "date",
    "asc",
    relationshipFilter
  );

  // Surface refresh to the parent so dialog-close (after create/edit) can
  // force a revalidate. The dependency array intentionally omits
  // `refreshSessions` — SWR's mutate identity is stable per key, but adding
  // it here would cause the parent's stored callback to swap on every
  // window-tick re-render, defeating the parent's `useCallback` memo.
  useEffect(() => {
    onRefreshNeeded?.(refreshSessions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefreshNeeded]);

  // Sessions starting exactly at `now` belong in Upcoming. Previous is reversed
  // so the most recent session appears first, matching the prior `desc` fetch.
  // `{ zone: "utc" }` matches the row formatter (`coaching-sessions-row.tsx`)
  // because the backend ships naive ISO datetime strings — without it Luxon
  // parses in the viewer's local zone, shifting the absolute time by the user's
  // UTC offset and bucketing boundary sessions into the wrong tab.
  const { upcomingSessions, previousSessions } = useMemo(() => {
    const upcoming: EnrichedCoachingSession[] = [];
    const previous: EnrichedCoachingSession[] = [];
    for (const session of allSessions) {
      if (DateTime.fromISO(session.date, { zone: "utc" }) >= now) {
        upcoming.push(session);
      } else {
        previous.push(session);
      }
    }
    previous.reverse();
    return { upcomingSessions: upcoming, previousSessions: previous };
  }, [allSessions, now]);

  // Hover state is owned here — not in `CoachingSessionsListView` — so the
  // hovered session's relationship can key the action fetch below. This
  // mirrors `usePanelActions::useReviewWindow` on the session page: actions
  // are scoped at the API layer by `coaching_relationship_id`, never
  // post-filtered client-side. Without this, the hover preview would surface
  // actions from other coachees' relationships.
  const [hoveredSessionId, setHoveredSessionId] = useState<Id | undefined>();
  const hoveredSession = useMemo(
    () => allSessions.find((s) => s.id === hoveredSessionId),
    [allSessions, hoveredSessionId]
  );

  // The relationship to scope actions by: an explicit filter takes priority,
  // otherwise follow the hovered session. When neither is set, skip the
  // fetch entirely (passing `null` as `userId`) — there's nothing to show.
  const actionsRelationshipId =
    relationshipFilter ?? hoveredSession?.coaching_relationship_id;
  const { actions: allActions } = useUserActionsList(
    actionsRelationshipId ? (userId ?? null) : null,
    actionsRelationshipId
      ? {
          scope: UserActionsScope.Sessions,
          coaching_relationship_id: actionsRelationshipId,
        }
      : undefined
  );

  // ── Delete flow ──────────────────────────────────────────────────────
  // The dialog and mutation live here (alongside SWR) so a single dialog
  // instance serves every row and SWR cache invalidation runs at the same
  // scope as the fetch that populated it. `useEntityMutation` auto-mutates
  // every SWR key matching the entity baseUrl on success — no manual
  // refresh call is needed.
  const { delete: deleteSession } = useCoachingSessionMutation();
  const [sessionPendingDelete, setSessionPendingDelete] = useState<
    EnrichedCoachingSession | undefined
  >(undefined);
  const [isDeleting, setIsDeleting] = useState(false);

  const pendingParticipantName = useMemo(() => {
    if (!sessionPendingDelete || !userSession) return "";
    const info = getSessionParticipantInfo(sessionPendingDelete, userSession.id);
    return info?.participantName ?? "Unknown";
  }, [sessionPendingDelete, userSession]);

  const handleRequestDelete = useCallback(
    (session: EnrichedCoachingSession) => setSessionPendingDelete(session),
    []
  );

  const handleCancelDelete = useCallback(() => {
    setSessionPendingDelete(undefined);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!sessionPendingDelete) return;
    const target = sessionPendingDelete;
    setIsDeleting(true);
    try {
      await deleteSession(target.id);
      // `useEntityMutation`'s built-in cache invalidation matches keys
      // containing the entity baseUrl (`coaching_sessions/`), but the
      // dashboard fetches via `useEnrichedCoachingSessionsForUser` which
      // hits a *user-scoped* endpoint — its cache key doesn't match, so
      // the deleted row would linger until a hard refresh. Pull the
      // hook's own `refresh()` instead. Disappearance of the row is the
      // only feedback the user gets (no success toast — confirmation
      // already happened via the dialog), so this revalidate is
      // load-bearing.
      refreshSessions();
      setSessionPendingDelete(undefined);
    } catch (err) {
      sonnerToast.error("Failed to delete session", {
        description:
          err instanceof Error ? err.message : "Please try again.",
      });
      setSessionPendingDelete(undefined);
    } finally {
      setIsDeleting(false);
    }
  }, [sessionPendingDelete, deleteSession, refreshSessions]);

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
            now={mountNow}
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
              hoveredSession={hoveredSession}
              onHoverChange={setHoveredSessionId}
              onReschedule={onReschedule}
              onRequestDelete={handleRequestDelete}
            />
          )}
        </CardContent>
      </Card>
      <DeleteSessionDialog
        session={sessionPendingDelete}
        participantName={pendingParticipantName}
        userTimezone={userSession?.timezone || getBrowserTimezone()}
        isDeleting={isDeleting}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
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
