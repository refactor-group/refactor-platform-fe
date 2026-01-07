import { useMemo, useState, useEffect, useCallback } from "react";
import { getOneYearAgo, getOneYearFromNow } from "@/lib/utils/date-utils";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { UserActionsApi } from "@/lib/api/user-actions";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import type { Action } from "@/types/action";
import {
  AssignedActionsFilter,
  UserActionsScope,
} from "@/types/assigned-actions";
import {
  buildSessionLookupMaps,
  processActions,
} from "@/lib/utils/assigned-actions-utils";

// ============================================================================
// Helper Hook: Fetch actions for multiple coachees in parallel
// ============================================================================

interface UseCoacheeActionsFetchResult {
  actions: Action[];
  isLoading: boolean;
  isError: Error | null;
  refresh: () => void;
}

/**
 * Fetches actions for multiple coachees in parallel.
 * Returns flattened array of all coachee actions.
 */
function useCoacheeActionsFetch(
  coacheeIds: string[],
  enabled: boolean
): UseCoacheeActionsFetchResult {
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isError, setIsError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Stable key to avoid refetching when array reference changes
  const coacheeIdsKey = useMemo(() => coacheeIds.join(","), [coacheeIds]);

  useEffect(() => {
    if (!enabled || coacheeIds.length === 0) {
      setActions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(null);

    Promise.all(
      coacheeIds.map((id) =>
        UserActionsApi.list(id, { scope: UserActionsScope.Assigned })
      )
    )
      .then((results) => {
        setActions(results.flat());
        setIsLoading(false);
      })
      .catch((error) => {
        setIsError(error);
        setIsLoading(false);
      });
  }, [enabled, coacheeIdsKey, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { actions, isLoading, isError, refresh };
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Fetches and processes actions assigned to coachees of the current user (coach).
 *
 * Pipeline: fetch coachee actions → fetch sessions → filter → enrich → group
 *
 * @param filter - Filter type (DueSoon, AllIncomplete, Completed)
 * @param enabled - Set to false to skip all fetching
 */
export function useCoacheeAssignedActions(
  filter: AssignedActionsFilter = AssignedActionsFilter.DueSoon,
  enabled: boolean = true
) {
  // -------------------------------------------------------------------------
  // Step 1: Get current user and their coachees
  // -------------------------------------------------------------------------

  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const userId = userSession?.id ?? null;

  const { currentOrganizationId } = useCurrentOrganization();

  const { relationships, isLoading: relationshipsLoading } =
    useCoachingRelationshipList(enabled ? (currentOrganizationId ?? "") : "");

  const coacheeIds = useMemo(() => {
    if (!enabled || !userId || !relationships) return [];
    return relationships
      .filter((r) => r.coach_id === userId)
      .map((r) => r.coachee_id);
  }, [enabled, userId, relationships]);

  // -------------------------------------------------------------------------
  // Step 2: Fetch data (actions for coachees + sessions for context)
  // -------------------------------------------------------------------------

  const {
    actions: rawActions,
    isLoading: actionsLoading,
    isError: actionsError,
    refresh,
  } = useCoacheeActionsFetch(coacheeIds, enabled);

  const oneYearAgo = useMemo(() => getOneYearAgo(), []);
  const oneYearFromNow = useMemo(() => getOneYearFromNow(), []);

  const {
    enrichedSessions: sessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useEnrichedCoachingSessionsForUser(
    enabled ? userId : null,
    oneYearAgo,
    oneYearFromNow,
    [CoachingSessionInclude.Relationship, CoachingSessionInclude.Goal]
  );

  // -------------------------------------------------------------------------
  // Step 3: Process actions (filter → enrich → group)
  // -------------------------------------------------------------------------

  const lookupMaps = useMemo(
    () => buildSessionLookupMaps(sessions ?? []),
    [sessions]
  );

  const processed = useMemo(
    () => processActions(rawActions, filter, null, lookupMaps),
    [rawActions, filter, lookupMaps]
  );

  // -------------------------------------------------------------------------
  // Step 4: Aggregate loading/error states and return
  // -------------------------------------------------------------------------

  const isLoading =
    enabled && (relationshipsLoading || actionsLoading || sessionsLoading);
  const isError = enabled && (actionsError || sessionsError);

  return {
    ...processed,
    isLoading,
    isError,
    refresh,
  };
}
