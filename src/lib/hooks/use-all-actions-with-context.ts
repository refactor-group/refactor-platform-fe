import { useMemo, useState, useCallback, useEffect } from "react";
import { getOneYearAgo, getOneYearFromNow } from "@/lib/utils/date";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUserActionsList, UserActionsApi } from "@/lib/api/user-actions";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import {
  CoachViewMode,
  UserActionsScope,
} from "@/types/assigned-actions";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import type { Action } from "@/types/action";
import {
  buildSessionLookupMaps,
  addContextToActions,
} from "@/lib/utils/assigned-actions";
import { getRelationshipsAsCoach } from "@/types/coaching-relationship";

// ============================================================================
// Internal helper: fetch actions for all coachees
// ============================================================================

interface CoacheeActionsFetchResult {
  actions: Action[];
  isLoading: boolean;
  isError: boolean;
  refresh: () => void;
}

/**
 * Fetches actions for all coachee IDs in parallel.
 * Uses a stable string key to avoid infinite re-render loops from array identity changes.
 */
function useCoacheeActionsFetch(
  coacheeIds: string[],
  enabled: boolean
): CoacheeActionsFetchResult {
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isError, setIsError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const coacheeIdsKey = useMemo(() => coacheeIds.join(","), [coacheeIds]);

  useEffect(() => {
    if (!enabled || coacheeIds.length === 0) {
      setActions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);

    Promise.all(
      coacheeIds.map((id) =>
        UserActionsApi.list(id, { scope: UserActionsScope.Assigned })
      )
    )
      .then((results) => {
        setActions(results.flat());
        setIsLoading(false);
      })
      .catch(() => {
        setIsError(true);
        setIsLoading(false);
      });
    // coacheeIds is intentionally omitted — coacheeIdsKey is the stable string proxy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, coacheeIdsKey, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { actions, isLoading, isError, refresh };
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Fetches and enriches all actions for the current user (or their coachees).
 *
 * Unlike useAssignedActions, this hook skips filterActionsByStatus and
 * groupActionsByRelationship — the kanban board groups by status column
 * and applies its own client-side filters.
 *
 * @param viewMode - Whether to show the user's own actions or their coachees' actions
 */
export function useAllActionsWithContext(viewMode: CoachViewMode) {
  // ---------------------------------------------------------------------------
  // Step 1: Get current user + org context
  // ---------------------------------------------------------------------------

  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const userId = userSession?.id ?? null;
  const { currentOrganizationId } = useCurrentOrganization();

  const isCoacheeMode = viewMode === CoachViewMode.CoacheeActions;

  // ---------------------------------------------------------------------------
  // Step 2a: Fetch current user's actions (My Actions mode)
  // ---------------------------------------------------------------------------

  const {
    actions: myRawActions,
    isLoading: myActionsLoading,
    isError: myActionsError,
    refresh: refreshMyActions,
  } = useUserActionsList(
    !isCoacheeMode ? userId : null,
    { scope: UserActionsScope.Assigned }
  );

  // ---------------------------------------------------------------------------
  // Step 2b: Fetch coachee actions (Coachee Actions mode)
  // ---------------------------------------------------------------------------

  const { relationships, isLoading: relsLoading } =
    useCoachingRelationshipList(
      isCoacheeMode ? (currentOrganizationId ?? "") : ""
    );

  const coacheeIds = useMemo(() => {
    if (!isCoacheeMode || !userId || !relationships) return [];
    return getRelationshipsAsCoach(userId, relationships).map(
      (r) => r.coachee_id
    );
  }, [isCoacheeMode, userId, relationships]);

  const {
    actions: coacheeRawActions,
    isLoading: coacheeActionsLoading,
    isError: coacheeActionsError,
    refresh: refreshCoacheeActions,
  } = useCoacheeActionsFetch(coacheeIds, isCoacheeMode);

  // ---------------------------------------------------------------------------
  // Step 3: Fetch enriched sessions for context
  // ---------------------------------------------------------------------------

  const oneYearAgo = useMemo(() => getOneYearAgo(), []);
  const oneYearFromNow = useMemo(() => getOneYearFromNow(), []);

  const {
    enrichedSessions: sessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useEnrichedCoachingSessionsForUser(userId, oneYearAgo, oneYearFromNow, [
    CoachingSessionInclude.Relationship,
    CoachingSessionInclude.Goal,
  ]);

  // ---------------------------------------------------------------------------
  // Step 4: Build maps + enrich (skip filtering — kanban shows all statuses)
  // ---------------------------------------------------------------------------

  const rawActions = useMemo(
    () => (isCoacheeMode ? coacheeRawActions : (myRawActions ?? [])),
    [isCoacheeMode, coacheeRawActions, myRawActions]
  );

  const lookupMaps = useMemo(
    () => buildSessionLookupMaps(sessions ?? []),
    [sessions]
  );

  const actionsWithContext: AssignedActionWithContext[] = useMemo(
    () =>
      addContextToActions(
        rawActions,
        lookupMaps.sessionMap,
        lookupMaps.nextSessionByRelationship
      ),
    [rawActions, lookupMaps]
  );

  // ---------------------------------------------------------------------------
  // Step 5: Aggregate loading/error states and return
  // ---------------------------------------------------------------------------

  const isLoading =
    !userId ||
    sessionsLoading ||
    (isCoacheeMode
      ? relsLoading || coacheeActionsLoading
      : myActionsLoading);

  const isError =
    sessionsError ||
    (isCoacheeMode ? coacheeActionsError : myActionsError);

  const refresh = isCoacheeMode ? refreshCoacheeActions : refreshMyActions;

  return {
    actionsWithContext,
    isLoading,
    isError,
    refresh,
  };
}
