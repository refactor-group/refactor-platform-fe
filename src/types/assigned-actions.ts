/**
 * Types for the assigned actions system used by the What's Due dashboard.
 *
 * This file contains:
 * - API query parameter enums (UserActionsScope, UserActionsAssigneeFilter)
 * - UI filter enums (AssignedActionsFilter, CoachViewMode)
 * - Context interfaces for enriching actions with relationship/goal/session data
 * - Grouped action types for hierarchical display (by relationship, then by goal)
 */

import { DateTime } from "ts-luxon";
import type { Id } from "@/types/general";
import type { Action } from "@/types/action";

// ============================================================================
// API Query Parameter Types
// ============================================================================

/**
 * Scope for user actions API query.
 * - Sessions: All actions from sessions where user is coach or coachee
 * - Assigned: Only actions where user is an assignee
 */
export enum UserActionsScope {
  Sessions = "sessions",
  Assigned = "assigned",
}

/**
 * Filter for actions by assignee status in API queries.
 * - Assigned: Only actions that have at least one assignee
 * - Unassigned: Only actions with no assignees
 */
export enum UserActionsAssigneeFilter {
  Assigned = "assigned",
  Unassigned = "unassigned",
}

// ============================================================================
// UI Filter Types
// ============================================================================

/**
 * Filter options for the What's Due dashboard
 */
export enum AssignedActionsFilter {
  DueSoon = "due_soon",
  AllIncomplete = "all_incomplete",
  AllUnassigned = "all_unassigned",
  Completed = "completed",
}

/**
 * View mode for coaches to switch between their own actions and coachee actions
 */
export enum CoachViewMode {
  MyActions = "my_actions",
  CoacheeActions = "coachee_actions",
}

/**
 * Context about the coaching relationship for an action
 */
export interface RelationshipContext {
  coachingRelationshipId: Id;
  coachId: Id;
  coacheeId: Id;
  coachName: string;
  coacheeName: string;
}

/**
 * Context about the overarching goal for an action
 */
export interface GoalContext {
  overarchingGoalId: Id;
  title: string;
}

/**
 * Context about the next session for determining due date
 */
export interface SessionContext {
  coachingSessionId: Id;
  sessionDate: DateTime;
}

/**
 * An Action enriched with relationship, goal, and session context
 * for display in the What's Due dashboard
 */
export interface AssignedActionWithContext {
  action: Action;
  relationship: RelationshipContext;
  goal: GoalContext;
  nextSession: SessionContext | null;
  isOverdue: boolean;
}

/**
 * Actions grouped by overarching goal within a relationship
 */
export interface GoalGroupedActions {
  goal: GoalContext;
  actions: AssignedActionWithContext[];
}

/**
 * Actions grouped by coaching relationship
 */
export interface RelationshipGroupedActions {
  relationship: RelationshipContext;
  nextSession: SessionContext | null;
  goalGroups: GoalGroupedActions[];
  totalActions: number;
  overdueCount: number;
}
