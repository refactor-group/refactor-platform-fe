"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "ts-luxon";
import { toast as sonnerToast } from "sonner";
import { useSWRConfig } from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CoachingSessionsCardHeader,
  type RelationshipOption,
} from "@/components/ui/dashboard/coaching-sessions-card-header";
import { BucketsContainer } from "@/components/ui/dashboard/session-buckets/buckets-container";
import { DeleteSessionDialog } from "@/components/ui/dashboard/delete-session-dialog";
import { SeriesActionDialogs } from "@/components/ui/dashboard/series-action-dialogs";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingSessionsCardFilterStore } from "@/lib/providers/coaching-sessions-card-filter-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCoachingSessionMutation } from "@/lib/api/coaching-sessions";
import { USERS_BASEURL } from "@/lib/api/users";
import type { Id } from "@/types/general";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import { getSessionParticipantInfo } from "@/lib/utils/session";
import {
  type CoachingSession,
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

/**
 * Models the only legal states of the delete-confirmation flow. Using a
 * discriminated union over `{ session: T | undefined } + { isDeleting:
 * boolean }` so the type system rejects `isDeleting=true` with no
 * session — an impossible state that two parallel `useState` calls
 * would silently allow.
 */
type DeleteDialogState =
  | { kind: "closed" }
  | { kind: "pending"; session: EnrichedCoachingSession }
  | { kind: "deleting"; session: EnrichedCoachingSession };

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
  /** Fires after a series is rescheduled or deleted from a session row's
   *  kebab. Re-materialization changes future sessions across surfaces, so
   *  the parent uses this to refresh sibling cards (e.g. UpcomingSession).
   *  The card already revalidates its own buckets internally. */
  onSeriesMutated?: () => void;
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
}: CoachingSessionsCardProps) {
  const userSession = useAuthStore((s) => s.userSession);
  const userId = userSession?.id;
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

  // ── Delete flow ──────────────────────────────────────────────────────
  // The dialog and mutation live here (alongside SWR) so a single dialog
  // instance serves every row and SWR cache invalidation runs at the same
  // scope as the fetch that populated it. `useEntityMutation` auto-mutates
  // every SWR key matching the entity baseUrl on success — no manual
  // refresh call is needed (but see #387 for the tuple-key gap that
  // forces the explicit `refreshSessions()` below).
  //
  // Discriminated union models the only legal states: `closed`, `pending`
  // (dialog open, awaiting confirm), `deleting` (mutation in flight). The
  // alternative — separate `session: T | undefined` + `isDeleting:
  // boolean` — admits an impossible state (deleting with no session)
  // that the type system would never catch. Following the project's
  // strict-nullability convention.
  const { delete: deleteSession } = useCoachingSessionMutation();
  const [deleteState, setDeleteState] = useState<DeleteDialogState>({
    kind: "closed",
  });

  // ── Series actions ───────────────────────────────────────────────────
  // A session row's kebab surfaces view / edit / delete for the series it
  // belongs to. The row only knows the `coaching_session_series_id`, so the
  // owning dialog component fetches the full series by id. A single piece of
  // state drives all three dialogs; `SeriesActionDialogs` mounts only while
  // active so its fetch hook always receives a real id.
  const [seriesAction, setSeriesAction] = useState<
    { kind: "closed" } | { kind: "view" | "edit" | "delete"; seriesId: Id }
  >({ kind: "closed" });

  const handleSeriesAction = useCallback(
    (action: "view" | "edit" | "delete", seriesId: Id) =>
      setSeriesAction({ kind: action, seriesId }),
    []
  );

  const handleCloseSeriesAction = useCallback(
    () => setSeriesAction({ kind: "closed" }),
    []
  );

  // After a reschedule/delete the future sessions change, so revalidate this
  // card's buckets and let the parent refresh sibling cards.
  const handleSeriesMutated = useCallback(() => {
    refreshBucketData();
    onSeriesMutated?.();
  }, [refreshBucketData, onSeriesMutated]);

  const pendingParticipantName = useMemo(() => {
    if (deleteState.kind === "closed" || !userSession) return "";
    const info = getSessionParticipantInfo(deleteState.session, userSession.id);
    return info?.participantName ?? "Unknown";
  }, [deleteState, userSession]);

  const handleRequestDelete = useCallback(
    (session: EnrichedCoachingSession) =>
      setDeleteState({ kind: "pending", session }),
    []
  );

  const handleCancelDelete = useCallback(() => {
    setDeleteState({ kind: "closed" });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (deleteState.kind !== "pending") return;
    const { session } = deleteState;
    setDeleteState({ kind: "deleting", session });
    try {
      await deleteSession(session.id);
      // `useEntityMutation`'s built-in cache invalidation matches keys
      // containing the entity baseUrl (`coaching_sessions/`), but the
      // dashboard fetches go through the user-scoped endpoint — those
      // cache keys are tuples that the string-only matcher misses.
      // Disappearance of the row is the only feedback the user gets,
      // so this revalidate is load-bearing.
      refreshBucketData();
      setDeleteState({ kind: "closed" });
    } catch (err) {
      sonnerToast.error("Failed to delete session", {
        description:
          err instanceof Error ? err.message : "Please try again.",
      });
      setDeleteState({ kind: "closed" });
    }
  }, [deleteState, deleteSession, refreshBucketData]);

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

          {userSession && userId && (
            <BucketsContainer
              userId={userId}
              relationshipFilter={relationshipFilter}
              viewerId={userSession.id}
              userTimezone={userSession.timezone || getBrowserTimezone()}
              mountNow={mountNow}
              onReschedule={onReschedule}
              onRequestDelete={handleRequestDelete}
              onSeriesAction={handleSeriesAction}
            />
          )}
        </CardContent>
      </Card>
      {/* Translate the discriminated state at the boundary — the dialog
          remains a generic primitive that takes
          `session?: T` + `isDeleting: boolean`. */}
      <DeleteSessionDialog
        session={
          deleteState.kind === "closed" ? undefined : deleteState.session
        }
        participantName={pendingParticipantName}
        userTimezone={userSession?.timezone || getBrowserTimezone()}
        isDeleting={deleteState.kind === "deleting"}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
      <SeriesActionDialogs
        action={seriesAction}
        userTimezone={userSession?.timezone || getBrowserTimezone()}
        onClose={handleCloseSeriesAction}
        onMutated={handleSeriesMutated}
      />
    </TooltipProvider>
  );
}

