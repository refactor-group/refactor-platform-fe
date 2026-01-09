import { useMemo } from "react";
import { getOneYearAgo, getOneYearFromNow } from "@/lib/utils/date";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUserActionsList } from "@/lib/api/user-actions";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import {
  AssignedActionsFilter,
  UserActionsScope,
} from "@/types/assigned-actions";
import {
  buildSessionLookupMaps,
  processActions,
} from "@/lib/utils/assigned-actions";

// Re-export filterActionsByStatus for use in tests
export { filterActionsByStatus } from "@/lib/utils/assigned-actions";

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Fetches and processes actions for the current user.
 *
 * Pipeline: fetch actions → fetch sessions → filter → enrich → group
 *
 * @param filter - Filter type (DueSoon, AllIncomplete, AllUnassigned, Completed)
 */
export function useAssignedActions(
  filter: AssignedActionsFilter = AssignedActionsFilter.DueSoon
) {
  // -------------------------------------------------------------------------
  // Step 1: Get current user
  // -------------------------------------------------------------------------

  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const userId = userSession?.id ?? null;

  // -------------------------------------------------------------------------
  // Step 2: Fetch data (actions + sessions for context)
  // -------------------------------------------------------------------------

  const {
    actions: rawActions,
    isLoading: actionsLoading,
    isError: actionsError,
    refresh,
  } = useUserActionsList(userId, { scope: UserActionsScope.Sessions });

  const oneYearAgo = useMemo(() => getOneYearAgo(), []);
  const oneYearFromNow = useMemo(() => getOneYearFromNow(), []);

  const {
    enrichedSessions: sessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useEnrichedCoachingSessionsForUser(
    userId,
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
    () => processActions(rawActions ?? [], filter, userId, lookupMaps),
    [rawActions, filter, userId, lookupMaps]
  );

  // -------------------------------------------------------------------------
  // Step 4: Aggregate loading/error states and return
  // -------------------------------------------------------------------------

  const isLoading = !userId || actionsLoading || sessionsLoading;
  const isError = actionsError || sessionsError;

  return {
    ...processed,
    isLoading,
    isError,
    refresh,
  };
}
