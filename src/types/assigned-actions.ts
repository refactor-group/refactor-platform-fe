/**
 * Types for the assigned actions system.
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
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";

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

/**
 * UI-level filter for assignment status on the actions page.
 * Maps to different combinations of scope + assignee_filter API params.
 */
export enum AssignmentFilter {
  Assigned = "assigned",
  Unassigned = "unassigned",
  All = "all",
}

// ============================================================================
// UI Filter Types
// ============================================================================

/**
 * Filter options for assigned actions
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

// ============================================================================
// Kanban Board Filter Types (Global Actions Page)
// ============================================================================

/**
 * Which kanban status columns are visible
 */
export enum StatusVisibility {
  Open = "open",
  All = "all",
  Closed = "closed",
}

/**
 * Time range for filtering actions on the kanban board
 */
export enum TimeRange {
  Last30Days = "last_30_days",
  Last90Days = "last_90_days",
  AllTime = "all_time",
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
 * for display in action summaries and the Actions page
 */
export interface AssignedActionWithContext {
  action: Action;
  relationship: CoachingRelationshipWithUserNames;
  goal: GoalContext;
  sourceSession: SessionContext;
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
  relationship: CoachingRelationshipWithUserNames;
  nextSession: SessionContext | null;
  goalGroups: GoalGroupedActions[];
  totalActions: number;
  overdueCount: number;
}
