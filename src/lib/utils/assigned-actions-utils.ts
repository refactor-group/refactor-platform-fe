/**
 * Shared utility functions for assigned actions hooks.
 * Used by both useAssignedActions and useCoacheeAssignedActions.
 */

import { DateTime } from "ts-luxon";
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
import {
  findNextSessionsByRelationship,
  findLastSessionsByRelationship,
} from "@/lib/utils/session-utils";

// ============================================================================
// Types
// ============================================================================

/** Lookup maps built from enriched sessions for efficient action processing */
export interface SessionLookupMaps {
  sessionMap: Map<Id, EnrichedCoachingSession>;
  nextSessionByRelationship: Map<Id, EnrichedCoachingSession>;
  lastSessionByRelationship: Map<Id, EnrichedCoachingSession>;
}

// ============================================================================
// Lookup Map Builders
// ============================================================================

/**
 * Builds a lookup map from session ID to enriched coaching session.
 * Enables O(1) session lookups when processing actions.
 */
export function buildSessionMap(sessions: EnrichedCoachingSession[]) {
  const map = new Map<Id, EnrichedCoachingSession>();
  sessions.forEach((s) => map.set(s.id, s));
  return map;
}

/**
 * Builds all session lookup maps needed for action processing.
 * Consolidates three map-building operations into one call.
 */
export function buildSessionLookupMaps(
  sessions: EnrichedCoachingSession[]
): SessionLookupMaps {
  return {
    sessionMap: buildSessionMap(sessions),
    nextSessionByRelationship: findNextSessionsByRelationship(sessions),
    lastSessionByRelationship: findLastSessionsByRelationship(sessions),
  };
}

// ============================================================================
// Action Filtering - Helper Functions
// ============================================================================

/** Checks if action is assigned to the specified user */
function isAssignedToUser(action: Action, userId: Id): boolean {
  return action.assignee_ids?.includes(userId) ?? false;
}

/** Checks if action has no assignees */
function hasNoAssignees(action: Action): boolean {
  return !action.assignee_ids || action.assignee_ids.length === 0;
}

/** Checks if action is due before the next session for its relationship */
function isDueBeforeNextSession(
  action: Action,
  sessionMap: Map<Id, EnrichedCoachingSession>,
  nextSessionByRelationship: Map<Id, EnrichedCoachingSession>
): boolean {
  const session = sessionMap.get(action.coaching_session_id);
  if (!session) return true; // Include if no session context

  const nextSession = nextSessionByRelationship.get(
    session.coaching_relationship_id
  );
  if (!nextSession) return true; // Include if no next session scheduled

  const nextSessionDate = DateTime.fromISO(nextSession.date);
  return action.due_by <= nextSessionDate;
}

/** Checks if action was completed since the last session for its relationship */
function wasCompletedSinceLastSession(
  action: Action,
  sessionMap: Map<Id, EnrichedCoachingSession>,
  lastSessionByRelationship: Map<Id, EnrichedCoachingSession>
): boolean {
  const session = sessionMap.get(action.coaching_session_id);
  if (!session) return true; // Include if no session context

  const lastSession = lastSessionByRelationship.get(
    session.coaching_relationship_id
  );
  if (!lastSession) return true; // Include if no last session

  const lastSessionDate = DateTime.fromISO(lastSession.date);
  return action.status_changed_at >= lastSessionDate;
}

// ============================================================================
// Action Filtering - Main Function
// ============================================================================

/**
 * Filters actions based on the selected filter type and optional user context.
 *
 * Filter behaviors:
 * - DueSoon: Incomplete actions assigned to user, due before next session
 * - AllIncomplete: All incomplete actions assigned to user
 * - AllUnassigned: Actions with no assignees (ignores userId)
 * - Completed: Completed actions assigned to user, since last session
 *
 * @param userId - When provided, filters to actions assigned to this user.
 *   When null, skips user assignment check (useful for coachee views).
 */
export function filterActionsByStatus(
  actions: Action[],
  filter: AssignedActionsFilter,
  userId: Id | null,
  sessionMap: Map<Id, EnrichedCoachingSession>,
  nextSessionByRelationship: Map<Id, EnrichedCoachingSession>,
  lastSessionByRelationship: Map<Id, EnrichedCoachingSession>
): Action[] {
  return actions.filter((action) => {
    const isCompleted = action.status === ItemStatus.Completed;
    const passesUserFilter = !userId || isAssignedToUser(action, userId);

    switch (filter) {
      case AssignedActionsFilter.Completed:
        return (
          isCompleted &&
          passesUserFilter &&
          wasCompletedSinceLastSession(action, sessionMap, lastSessionByRelationship)
        );

      case AssignedActionsFilter.AllUnassigned:
        return !isCompleted && hasNoAssignees(action);

      case AssignedActionsFilter.AllIncomplete:
        return !isCompleted && passesUserFilter;

      case AssignedActionsFilter.DueSoon:
        return (
          !isCompleted &&
          passesUserFilter &&
          isDueBeforeNextSession(action, sessionMap, nextSessionByRelationship)
        );

      default:
        return false;
    }
  });
}

// ============================================================================
// Context Builders
// ============================================================================

/**
 * Builds relationship context from an enriched coaching session.
 * Extracts coach, coachee, and relationship IDs/names for display purposes.
 *
 * @param session - Enriched coaching session with relationship data
 * @returns RelationshipContext object with IDs and display names
 */
export function buildRelationshipContext(
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

/**
 * Builds goal context from an enriched coaching session.
 * Returns a "No Goal" placeholder if the session has no overarching goal.
 *
 * @param session - Enriched coaching session with optional goal data
 * @returns GoalContext object with goal ID and title
 */
export function buildGoalContext(session: EnrichedCoachingSession): GoalContext {
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

/**
 * Builds session context from an enriched coaching session.
 * Converts the session date string to a DateTime object.
 *
 * @param session - Enriched coaching session
 * @returns SessionContext object with session ID and parsed date
 */
export function buildSessionContext(session: EnrichedCoachingSession): SessionContext {
  return {
    coachingSessionId: session.id,
    sessionDate: DateTime.fromISO(session.date),
  };
}

// ============================================================================
// Action Context
// ============================================================================

/**
 * Enriches a single action with relationship, goal, and session context.
 * Also calculates whether the action is overdue based on current date.
 *
 * @param action - The action to enrich
 * @param sessionMap - Map of session IDs to enriched sessions
 * @param nextSessionByRelationship - Map of relationship IDs to next sessions
 * @returns Enriched action with context, or null if session/relationship not found
 */
export function addContextToAction(
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

/**
 * Enriches multiple actions with context information.
 * Filters out any actions that couldn't be enriched (missing session/relationship).
 *
 * @param actions - Array of actions to enrich
 * @param sessionMap - Map of session IDs to enriched sessions
 * @param nextSessionByRelationship - Map of relationship IDs to next sessions
 * @returns Array of enriched actions with context
 */
export function addContextToActions(
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

/**
 * Sorts actions by due date with overdue actions appearing first.
 * Within each category (overdue/not overdue), sorts by ascending due date.
 *
 * @param actions - Array of actions with context to sort
 * @returns New sorted array (does not mutate original)
 */
export function sortActionsByDueDate(
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

/**
 * Groups actions by their overarching goal.
 * Actions within each goal group are sorted by due date.
 *
 * @param actions - Array of actions with context to group
 * @returns Array of goal groups, each containing sorted actions
 */
export function groupActionsByGoal(
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

/**
 * Groups actions by coaching relationship, then by goal within each relationship.
 * Results are sorted by next session date (soonest first).
 * Actions without a next session appear at the end.
 *
 * @param actions - Array of actions with context to group
 * @returns Array of relationship groups sorted by next session date
 */
export function groupActionsByRelationship(
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
// Action Processing Pipeline
// ============================================================================

/** Result of processing actions through the full pipeline */
export interface ProcessedActions {
  groupedActions: RelationshipGroupedActions[];
  flatActions: AssignedActionWithContext[];
  totalCount: number;
  overdueCount: number;
}

/**
 * Processes raw actions through the complete pipeline:
 * filter → add context → group by relationship.
 *
 * @param rawActions - Raw actions from the API
 * @param filter - Filter type to apply
 * @param userId - User ID for filtering (null skips user assignment check)
 * @param lookupMaps - Session lookup maps for context enrichment
 */
export function processActions(
  rawActions: Action[],
  filter: AssignedActionsFilter,
  userId: Id | null,
  lookupMaps: SessionLookupMaps
): ProcessedActions {
  const { sessionMap, nextSessionByRelationship, lastSessionByRelationship } =
    lookupMaps;

  // Step 1: Filter actions by status
  const filteredActions = filterActionsByStatus(
    rawActions,
    filter,
    userId,
    sessionMap,
    nextSessionByRelationship,
    lastSessionByRelationship
  );

  // Step 2: Add context (relationship, goal, session info)
  const actionsWithContext = addContextToActions(
    filteredActions,
    sessionMap,
    nextSessionByRelationship
  );

  // Step 3: Group by relationship
  const groupedActions = groupActionsByRelationship(actionsWithContext);

  return {
    groupedActions,
    flatActions: actionsWithContext,
    totalCount: actionsWithContext.length,
    overdueCount: actionsWithContext.filter((a) => a.isOverdue).length,
  };
}
