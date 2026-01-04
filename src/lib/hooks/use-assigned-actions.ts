import { useMemo } from "react";
import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useSessionActionsList } from "@/lib/api/session-actions";
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
  userId: Id | null,
  sessionMap: Map<Id, EnrichedCoachingSession>,
  nextSessionByRelationship: Map<Id, EnrichedCoachingSession>
): Action[] {
  return actions.filter((action) => {
    // Only include incomplete actions
    if (action.status === ItemStatus.Completed) return false;

    if (filter === AssignedActionsFilter.AllUnassigned) {
      // Show actions with no assignees
      return !action.assignee_ids || action.assignee_ids.length === 0;
    }

    // For DueSoon and AllIncomplete, only show actions assigned to the current user
    const isAssignedToUser = userId && action.assignee_ids?.includes(userId);
    if (!isAssignedToUser) return false;

    if (filter === AssignedActionsFilter.AllIncomplete) {
      return true;
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

  // Skip if we don't have relationship data (shouldn't happen with enriched sessions)
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

// Empty result for when data is not yet available
const EMPTY_RESULT = {
  groupedActions: [] as RelationshipGroupedActions[],
  flatActions: [] as AssignedActionWithContext[],
  totalCount: 0,
  overdueCount: 0,
  isLoading: true,
  isError: false,
  refresh: () => {},
};

/**
 * Hook to fetch and enrich assigned actions for the current user,
 * grouped by coaching relationship and overarching goal.
 */
export function useAssignedActions(
  filter: AssignedActionsFilter = AssignedActionsFilter.DueSoon
) {
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  const userId = userSession?.id;

  // Fetch actions assigned to the user (only when userId is available)
  // Fetch all actions from user's sessions (assigned and unassigned)
  const {
    actions: rawActions,
    isLoading: actionsLoading,
    isError: actionsError,
    refresh: refreshActions,
  } = useSessionActionsList(userId);

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
    userId ?? null,
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

  // Filter and add context to actions
  const filteredActions = useMemo(
    () =>
      filterActionsByStatus(
        rawActions ?? [],
        filter,
        userId ?? null,
        sessionMap,
        nextSessionByRelationship
      ),
    [rawActions, filter, userId, sessionMap, nextSessionByRelationship]
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
