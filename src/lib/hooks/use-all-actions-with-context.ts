import { useEffect, useMemo } from "react";
import type { SWRConfiguration } from "swr";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useActionsFetch } from "@/lib/hooks/use-actions-fetch";
import { useSessionContextFetch } from "@/lib/hooks/use-session-context-fetch";
import { AssignmentFilter, CoachViewMode } from "@/types/assigned-actions";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import type { Action } from "@/types/action";
import type { Id } from "@/types/general";
import { addContextToActions } from "@/lib/utils/assigned-actions";

// Session ids each session cache was already refetched for, kept across
// mounts. An id still missing after one refetch is outside that cache's
// window, so it isn't refetched again. Keyed per cache because mounts from
// different days hold different ones, and each needs its own refetch.
const refetchedForSessions = new Set<string>();
const refetchKey = (cacheKey: string, sessionId: Id) => `${cacheKey}|${sessionId}`;

/**
 * Refetches the session context when an action belongs to a session it
 * doesn't know, e.g. one created since the context was cached; without it the
 * action has no context and is left out.
 */
function useRefetchSessionsForUnknownActions(
  actions: Action[],
  knownSessionIds: Map<Id, unknown>,
  settled: boolean,
  cacheKey: string,
  refetchSessions: () => unknown
) {
  const unknownIds = settled
    ? [...new Set(actions.map((a) => a.coaching_session_id))]
        .filter((id) => !knownSessionIds.has(id) && !refetchedForSessions.has(refetchKey(cacheKey, id)))
        .join(",")
    : "";

  useEffect(() => {
    // Another instance sharing this cache may have refetched for these already.
    const fresh = unknownIds
      .split(",")
      .filter((id) => id && !refetchedForSessions.has(refetchKey(cacheKey, id)));
    if (fresh.length === 0) return;
    fresh.forEach((id) => refetchedForSessions.add(refetchKey(cacheKey, id)));
    refetchSessions();
  }, [unknownIds, cacheKey, refetchSessions]);
}

/**
 * Fetches and enriches all actions for the current user (or their coachees).
 *
 * Unlike useAssignedActions, this hook skips filterActionsByStatus and
 * groupActionsByRelationship — the kanban board groups by status column
 * and applies its own client-side filters.
 *
 * @param viewMode - Whether to show the user's own actions or their coachees' actions
 * @param relationshipId - Optional filter to a specific coaching relationship (server-side)
 * @param assignmentFilter - Filter by assignment status (assigned/unassigned/all)
 * @param options - SWR overrides for the actions and session fetches
 */
export function useAllActionsWithContext(
  viewMode: CoachViewMode,
  relationshipId?: Id,
  assignmentFilter: AssignmentFilter = AssignmentFilter.Assigned,
  options?: SWRConfiguration
) {
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const userId = userSession?.id ?? null;

  const {
    actions,
    isLoading: actionsLoading,
    isError: actionsError,
    refresh,
  } = useActionsFetch(viewMode, relationshipId, assignmentFilter, options);

  const {
    lookupMaps,
    isLoading: sessionsLoading,
    isError: sessionsError,
    refresh: refetchSessions,
    cacheKey: sessionCacheKey,
  } = useSessionContextFetch(userId, options);

  useRefetchSessionsForUnknownActions(
    actions,
    lookupMaps.sessionMap,
    !actionsLoading && !sessionsLoading && !actionsError && !sessionsError,
    sessionCacheKey,
    refetchSessions
  );

  const actionsWithContext: AssignedActionWithContext[] = useMemo(
    () =>
      addContextToActions(
        actions,
        lookupMaps.sessionMap,
        lookupMaps.nextSessionByRelationship
      ),
    [actions, lookupMaps]
  );

  const isLoading = !userId || actionsLoading || sessionsLoading;
  const isError = actionsError || sessionsError;

  return {
    actionsWithContext,
    isLoading,
    isError,
    refresh,
  };
}
