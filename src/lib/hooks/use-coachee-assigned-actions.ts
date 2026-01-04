// TODO: Discuss with Caleb - the current approach of fetching each coachee's
// assigned actions via /users/{coacheeId}/assigned-actions returns 401 because
// coaches don't have permission to access their coachees' actions directly.
// Options to consider:
// 1. New backend endpoint: GET /users/{coachId}/coachee-assigned-actions
// 2. New backend endpoint: GET /coaching-relationships/{relationshipId}/actions
// 3. Update backend authorization to allow coaches to read coachee actions

import { useMemo, useState, useEffect, useCallback } from "react";
import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { AssignedActionsApi } from "@/lib/api/assigned-actions";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import { findNextSessionsByRelationship } from "@/lib/sessions/session-utils";
import { ItemStatus, type Id } from "@/types/general";
import type { Action } from "@/types/action";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import {
  AssignedActionsFilter,
  type AssignedActionWithContext,
  type RelationshipContext,
  type GoalContext,
  type SessionContext,
  type GoalGroupedActions,
  type RelationshipGroupedActions,
} from "@/types/assigned-actions";

// ============================================================================
// Lookup Map Builders
// ============================================================================

function buildSessionMap(sessions: EnrichedCoachingSession[]) {
  const map = new Map<Id, EnrichedCoachingSession>();
  sessions.forEach((s) => map.set(s.id, s));
  return map;
}

// ============================================================================
// Action Filtering
// ============================================================================

function filterActionsByStatus(
  actions: Action[],
  filter: AssignedActionsFilter,
  sessionMap: Map<Id, EnrichedCoachingSession>,
  nextSessionByRelationship: Map<Id, EnrichedCoachingSession>
): Action[] {
  return actions.filter((action) => {
    // Only include incomplete actions
    if (action.status === ItemStatus.Completed) return false;

    if (filter === AssignedActionsFilter.AllIncomplete) {
      return true;
    }

    if (filter === AssignedActionsFilter.AllUnassigned) {
      // Show actions with no assignees
      return !action.assignee_ids || action.assignee_ids.length === 0;
    }

    // For "due_soon" filter, include actions due within the next session
    const session = sessionMap.get(action.coaching_session_id);
    if (!session) return true;

    const nextSession = nextSessionByRelationship.get(
      session.coaching_relationship_id
    );
    if (!nextSession) return true;

    const nextSessionDate = DateTime.fromISO(nextSession.date);
    return action.due_by <= nextSessionDate;
  });
}

// ============================================================================
// Context Builders
// ============================================================================

function buildRelationshipContext(
  session: EnrichedCoachingSession
): RelationshipContext {
  const coach = session.coach;
  const coachee = session.coachee;
  const relationship = session.relationship;

  return {
    coachingRelationshipId: relationship?.id ?? "",
    coachId: relationship?.coach_id ?? "",
    coacheeId: relationship?.coachee_id ?? "",
    coachName: coach
      ? `${coach.first_name} ${coach.last_name}`
      : "Unknown Coach",
    coacheeName: coachee
      ? `${coachee.first_name} ${coachee.last_name}`
      : "Unknown Coachee",
  };
}

function buildGoalContext(session: EnrichedCoachingSession): GoalContext {
  const goal = session.overarching_goal;
  if (goal) {
    return {
      overarchingGoalId: goal.id,
      title: goal.title,
    };
  }
  return {
    overarchingGoalId: "",
    title: "No Goal",
  };
}

function buildSessionContext(session: EnrichedCoachingSession): SessionContext {
  return {
    coachingSessionId: session.id,
    sessionDate: DateTime.fromISO(session.date),
  };
}

// ============================================================================
// Action Context
// ============================================================================

function addContextToAction(
  action: Action,
  sessionMap: Map<Id, EnrichedCoachingSession>,
  nextSessionByRelationship: Map<Id, EnrichedCoachingSession>
): AssignedActionWithContext | null {
  const session = sessionMap.get(action.coaching_session_id);
  if (!session) return null;

  // Skip if we don't have relationship data
  if (!session.relationship) return null;

  const nextSession = nextSessionByRelationship.get(
    session.coaching_relationship_id
  );

  // Compare dates only (not times) to avoid marking items due today as overdue
  const today = DateTime.now().startOf("day");
  const dueDate = action.due_by.startOf("day");
  const isOverdue = dueDate < today;

  return {
    action,
    relationship: buildRelationshipContext(session),
    goal: buildGoalContext(session),
    nextSession: nextSession ? buildSessionContext(nextSession) : null,
    isOverdue,
  };
}

function addContextToActions(
  actions: Action[],
  sessionMap: Map<Id, EnrichedCoachingSession>,
  nextSessionByRelationship: Map<Id, EnrichedCoachingSession>
): AssignedActionWithContext[] {
  return actions
    .map((action) =>
      addContextToAction(action, sessionMap, nextSessionByRelationship)
    )
    .filter((a): a is AssignedActionWithContext => a !== null);
}

// ============================================================================
// Grouping Logic
// ============================================================================

function sortActionsByDueDate(
  actions: AssignedActionWithContext[]
): AssignedActionWithContext[] {
  return [...actions].sort((a, b) => {
    // Overdue actions first
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    // Then by due date
    return a.action.due_by.toMillis() - b.action.due_by.toMillis();
  });
}

function groupActionsByGoal(
  actions: AssignedActionWithContext[]
): GoalGroupedActions[] {
  const goalGroups = new Map<Id, AssignedActionWithContext[]>();

  actions.forEach((action) => {
    const goalId = action.goal.overarchingGoalId;
    const existing = goalGroups.get(goalId) || [];
    goalGroups.set(goalId, [...existing, action]);
  });

  const result: GoalGroupedActions[] = [];
  goalGroups.forEach((goalActions) => {
    const sorted = sortActionsByDueDate(goalActions);
    result.push({
      goal: sorted[0].goal,
      actions: sorted,
    });
  });

  return result;
}

function groupActionsByRelationship(
  actions: AssignedActionWithContext[]
): RelationshipGroupedActions[] {
  const relationshipGroups = new Map<Id, AssignedActionWithContext[]>();

  actions.forEach((action) => {
    const relId = action.relationship.coachingRelationshipId;
    const existing = relationshipGroups.get(relId) || [];
    relationshipGroups.set(relId, [...existing, action]);
  });

  const result: RelationshipGroupedActions[] = [];

  relationshipGroups.forEach((relActions) => {
    const firstAction = relActions[0];
    const overdueCount = relActions.filter((a) => a.isOverdue).length;

    result.push({
      relationship: firstAction.relationship,
      nextSession: firstAction.nextSession,
      goalGroups: groupActionsByGoal(relActions),
      totalActions: relActions.length,
      overdueCount,
    });
  });

  // Sort by next session date
  return result.sort((a, b) => {
    if (!a.nextSession && !b.nextSession) return 0;
    if (!a.nextSession) return 1;
    if (!b.nextSession) return -1;
    return (
      a.nextSession.sessionDate.toMillis() -
      b.nextSession.sessionDate.toMillis()
    );
  });
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook to fetch and enrich assigned actions for all coachees of the current user (coach),
 * grouped by coaching relationship and overarching goal.
 *
 * @param filter - Filter for due soon or all incomplete actions
 * @param enabled - Whether to fetch data (set to false to skip fetching)
 */
export function useCoacheeAssignedActions(
  filter: AssignedActionsFilter = AssignedActionsFilter.DueSoon,
  enabled: boolean = true
) {
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  const userId = userSession?.id;
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

    Promise.all(coacheeIds.map((id) => AssignedActionsApi.list(id)))
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
  }, [enabled, coacheeIdsKey, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch enriched sessions for context - null skips the fetch
  const oneYearAgo = useMemo(() => DateTime.now().minus({ years: 1 }), []);
  const oneYearFromNow = useMemo(() => DateTime.now().plus({ years: 1 }), []);

  const {
    enrichedSessions: sessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useEnrichedCoachingSessionsForUser(
    enabled ? (userId ?? null) : null,
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

  // Filter and add context to actions
  const filteredActions = useMemo(
    () =>
      filterActionsByStatus(
        rawActions ?? [],
        filter,
        sessionMap,
        nextSessionByRelationship
      ),
    [rawActions, filter, sessionMap, nextSessionByRelationship]
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
