import { useMemo } from "react";
import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUserActionsList } from "@/lib/api/user-actions";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import {
  findNextSessionsByRelationship,
  findLastSessionsByRelationship,
} from "@/lib/sessions/session-utils";
import {
  AssignedActionsFilter,
  UserActionsScope,
  type RelationshipGroupedActions,
  type AssignedActionWithContext,
} from "@/types/assigned-actions";
import {
  buildSessionMap,
  filterActionsByStatus,
  addContextToActions,
  groupActionsByRelationship,
} from "./assigned-actions-utils";

// Re-export filterActionsByStatus for use in tests
export { filterActionsByStatus } from "./assigned-actions-utils";

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook to fetch and enrich assigned actions for the current user,
 * grouped by coaching relationship and overarching goal.
 *
 * @param filter - Filter type for actions (DueSoon, AllIncomplete, AllUnassigned, Completed)
 * @returns Object containing grouped actions, counts, loading state, and refresh function
 */
export function useAssignedActions(
  filter: AssignedActionsFilter = AssignedActionsFilter.DueSoon
) {
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  // Normalize userId at boundary: undefined -> null for consistent null handling
  const userId = userSession?.id ?? null;

  // Fetch all actions from user's sessions (assigned and unassigned)
  const {
    actions: rawActions,
    isLoading: actionsLoading,
    isError: actionsError,
    refresh: refreshActions,
  } = useUserActionsList(userId, { scope: UserActionsScope.Sessions });

  // Fetch enriched sessions for the user (with relationship and goal data)
  // Use a wide date range to cover historical and future sessions
  const oneYearAgo = useMemo(() => DateTime.now().minus({ years: 1 }), []);
  const oneYearFromNow = useMemo(() => DateTime.now().plus({ years: 1 }), []);

  // Only fetch sessions when userId is available - null skips the fetch
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

  // If no userId yet, return loading state - the sessions hook skips fetching with null userId
  const isLoading = !userId || actionsLoading || sessionsLoading;
  const isError = actionsError || sessionsError;

  // Build lookup maps
  const sessionMap = useMemo(
    () => buildSessionMap(sessions ?? []),
    [sessions]
  );

  const nextSessionByRelationship = useMemo(
    () => findNextSessionsByRelationship(sessions ?? []),
    [sessions]
  );

  const lastSessionByRelationship = useMemo(
    () => findLastSessionsByRelationship(sessions ?? []),
    [sessions]
  );

  // Filter and add context to actions
  const filteredActions = useMemo(
    () =>
      filterActionsByStatus(
        rawActions ?? [],
        filter,
        userId,
        sessionMap,
        nextSessionByRelationship,
        lastSessionByRelationship
      ),
    [rawActions, filter, userId, sessionMap, nextSessionByRelationship, lastSessionByRelationship]
  );

  const actionsWithContext = useMemo(
    () =>
      addContextToActions(
        filteredActions,
        sessionMap,
        nextSessionByRelationship
      ),
    [filteredActions, sessionMap, nextSessionByRelationship]
  );

  const groupedActions = useMemo(
    () => groupActionsByRelationship(actionsWithContext),
    [actionsWithContext]
  );

  return {
    groupedActions,
    flatActions: actionsWithContext,
    totalCount: actionsWithContext.length,
    overdueCount: actionsWithContext.filter((a) => a.isOverdue).length,
    isLoading,
    isError,
    refresh: refreshActions,
  };
}
