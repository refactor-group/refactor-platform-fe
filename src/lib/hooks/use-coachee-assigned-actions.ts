import { useMemo, useState, useEffect, useCallback } from "react";
import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { UserActionsApi } from "@/lib/api/user-actions";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import {
  findNextSessionsByRelationship,
  findLastSessionsByRelationship,
} from "@/lib/sessions/session-utils";
import type { Action } from "@/types/action";
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

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook to fetch and enrich assigned actions for all coachees of the current user (coach),
 * grouped by coaching relationship and overarching goal.
 *
 * @param filter - Filter for due soon or all incomplete actions
 * @param enabled - Whether to fetch data (set to false to skip fetching)
 * @returns Object containing grouped actions, counts, loading state, and refresh function
 */
export function useCoacheeAssignedActions(
  filter: AssignedActionsFilter = AssignedActionsFilter.DueSoon,
  enabled: boolean = true
) {
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  // Normalize userId at boundary: undefined -> null for consistent null handling
  const userId = userSession?.id ?? null;
  const { currentOrganizationId } = useCurrentOrganization();

  // Fetch coaching relationships to find coachees (only when enabled)
  const { relationships, isLoading: relationshipsLoading } =
    useCoachingRelationshipList(enabled ? (currentOrganizationId ?? "") : "");

  // Get coachee IDs where current user is the coach
  const coacheeIds = useMemo(() => {
    if (!enabled || !userId || !relationships) return [];
    return relationships
      .filter((r) => r.coach_id === userId)
      .map((r) => r.coachee_id);
  }, [enabled, userId, relationships]);

  // Create a stable string key for coacheeIds to use in useEffect dependencies
  const coacheeIdsKey = useMemo(() => coacheeIds.join(","), [coacheeIds]);

  // State for fetched actions
  const [rawActions, setRawActions] = useState<Action[]>([]);
  const [actionsLoading, setActionsLoading] = useState(enabled);
  const [actionsError, setActionsError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch actions for all coachees in parallel (only when enabled)
  useEffect(() => {
    if (!enabled) {
      setRawActions([]);
      setActionsLoading(false);
      return;
    }

    if (coacheeIds.length === 0) {
      setRawActions([]);
      setActionsLoading(false);
      return;
    }

    setActionsLoading(true);
    setActionsError(null);

    Promise.all(
      coacheeIds.map((id) =>
        UserActionsApi.list(id, { scope: UserActionsScope.Assigned })
      )
    )
      .then((results) => {
        // Flatten all coachee actions into a single array
        const allActions = results.flat();
        setRawActions(allActions);
        setActionsLoading(false);
      })
      .catch((error) => {
        setActionsError(error);
        setActionsLoading(false);
      });
    // Using coacheeIdsKey (memoized string) instead of coacheeIds array to avoid
    // re-fetching when array reference changes but content is identical
  }, [enabled, coacheeIdsKey, refreshKey]);

  // Fetch enriched sessions for context - null skips the fetch
  const oneYearAgo = useMemo(() => DateTime.now().minus({ years: 1 }), []);
  const oneYearFromNow = useMemo(() => DateTime.now().plus({ years: 1 }), []);

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

  // Aggregate loading and error states
  const isLoading = enabled && (relationshipsLoading || actionsLoading || sessionsLoading);
  const isError = enabled && (actionsError || sessionsError);

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
  // Note: userId is null - coachee actions don't filter by current user
  const filteredActions = useMemo(
    () =>
      filterActionsByStatus(
        rawActions ?? [],
        filter,
        null,
        sessionMap,
        nextSessionByRelationship,
        lastSessionByRelationship
      ),
    [rawActions, filter, sessionMap, nextSessionByRelationship, lastSessionByRelationship]
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

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return {
    groupedActions,
    flatActions: actionsWithContext,
    totalCount: actionsWithContext.length,
    overdueCount: actionsWithContext.filter((a) => a.isOverdue).length,
    isLoading,
    isError,
    refresh,
  };
}
