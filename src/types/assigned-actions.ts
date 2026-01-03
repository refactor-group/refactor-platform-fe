import { DateTime } from "ts-luxon";
import type { Id } from "@/types/general";
import type { Action } from "@/types/action";

/**
 * Filter options for the What's Due dashboard
 */
export enum AssignedActionsFilter {
  DueSoon = "due_soon",
  AllIncomplete = "all_incomplete",
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
