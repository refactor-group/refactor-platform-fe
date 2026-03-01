/**
 * Shared Test Utilities for Action-Related Tests
 *
 * This module provides reusable factories and utilities for testing
 * action filtering, counting, and display logic across multiple components:
 * - TodaySessionCard (actions due by session)
 * - ActionsSummary (inline action summary on session cards)
 * - useAssignedActions hook
 *
 * Centralizing these utilities ensures consistency and reduces duplication.
 */

import { DateTime } from "ts-luxon";
import type { Action } from "@/types/action";
import type {
  AssignedActionWithContext,
  GoalContext,
  SessionContext,
} from "@/types/assigned-actions";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { ItemStatus } from "@/types/general";

// ============================================================================
// UUID Generator
// ============================================================================

/**
 * Generates a valid UUID v4 for testing purposes.
 * Uses crypto.randomUUID if available, otherwise falls back to manual generation.
 */
export function generateTestUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// Common Test Constants (using real UUIDs)
// ============================================================================

/**
 * Standard relationship IDs for testing multi-relationship scenarios
 */
export const TEST_RELATIONSHIP_IDS = {
  PRIMARY: "a1b2c3d4-e5f6-4789-abcd-ef0123456789",
  SECONDARY: "b2c3d4e5-f6a7-4890-bcde-f01234567890",
  TERTIARY: "c3d4e5f6-a7b8-4901-cdef-012345678901",
} as const;

/**
 * Standard user IDs for testing
 */
export const TEST_USER_IDS = {
  CURRENT_USER: "d4e5f6a7-b8c9-4012-def0-123456789012",
  COACH: "e5f6a7b8-c9d0-4123-ef01-234567890123",
  COACHEE: "f6a7b8c9-d0e1-4234-f012-345678901234",
  OTHER_USER: "a7b8c9d0-e1f2-4345-0123-456789012345",
} as const;

/**
 * Standard session IDs for testing
 */
export const TEST_SESSION_IDS = {
  SESSION_1: "b8c9d0e1-f2a3-4456-1234-567890123456",
  SESSION_2: "c9d0e1f2-a3b4-4567-2345-678901234567",
  SESSION_3: "d0e1f2a3-b4c5-4678-3456-789012345678",
} as const;

/**
 * Standard goal IDs for testing
 */
export const TEST_GOAL_IDS = {
  GOAL_1: "e1f2a3b4-c5d6-4789-4567-890123456789",
  GOAL_2: "f2a3b4c5-d6e7-4890-5678-901234567890",
} as const;

/**
 * Reference date for tests: January 15, 2026 at 2:00 PM UTC
 * Using a fixed date ensures deterministic test behavior
 */
export const REFERENCE_DATE = DateTime.fromISO("2026-01-15T14:00:00.000Z");

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Options for creating a mock Action
 */
export interface MockActionOptions {
  id?: string;
  coachingSessionId?: string;
  userId?: string;
  body?: string;
  status?: ItemStatus;
  dueBy: DateTime;
  createdAt?: DateTime;
  statusChangedAt?: DateTime;
  assigneeIds?: string[];
}

/**
 * Creates a mock Action object for testing.
 *
 * @param options - Configuration for the mock action
 * @returns A fully-formed Action object
 */
export function createMockAction(options: MockActionOptions): Action {
  const now = DateTime.now();
  return {
    id: options.id ?? generateTestUUID(),
    coaching_session_id: options.coachingSessionId ?? TEST_SESSION_IDS.SESSION_1,
    user_id: options.userId ?? TEST_USER_IDS.CURRENT_USER,
    body: options.body ?? "Test action",
    status: options.status ?? ItemStatus.NotStarted,
    status_changed_at: options.statusChangedAt ?? now,
    due_by: options.dueBy,
    created_at: options.createdAt ?? now.minus({ days: 7 }),
    updated_at: now,
    assignee_ids: options.assigneeIds ?? [TEST_USER_IDS.CURRENT_USER],
  };
}

/**
 * Options for creating a mock AssignedActionWithContext
 */
export interface MockAssignedActionOptions extends MockActionOptions {
  relationshipId: string;
  coachId?: string;
  coacheeId?: string;
  coachFirstName?: string;
  coachLastName?: string;
  coacheeFirstName?: string;
  coacheeLastName?: string;
  goalId?: string;
  goalTitle?: string;
  sourceSession?: SessionContext;
  nextSession?: SessionContext | null;
  isOverdue?: boolean;
}

/**
 * Creates a mock AssignedActionWithContext object for testing.
 *
 * Strategy: Provide sensible defaults while allowing specific overrides for
 * the fields relevant to each test case. This keeps tests focused on the
 * behavior being verified rather than boilerplate setup.
 *
 * @param options - Configuration for the mock action with context
 * @returns A fully-formed AssignedActionWithContext object
 */
export function createMockAssignedAction(
  options: MockAssignedActionOptions
): AssignedActionWithContext {
  const action = createMockAction(options);

  const now = DateTime.now();
  const relationship: CoachingRelationshipWithUserNames = {
    id: options.relationshipId,
    coach_id: options.coachId ?? TEST_USER_IDS.COACH,
    coachee_id: options.coacheeId ?? TEST_USER_IDS.COACHEE,
    organization_id: "org-test",
    created_at: now,
    updated_at: now,
    coach_first_name: options.coachFirstName ?? "Coach",
    coach_last_name: options.coachLastName ?? "Name",
    coachee_first_name: options.coacheeFirstName ?? "Coachee",
    coachee_last_name: options.coacheeLastName ?? "Name",
  };

  const goal: GoalContext = {
    goalId: options.goalId ?? TEST_GOAL_IDS.GOAL_1,
    title: options.goalTitle ?? "Test Goal",
  };

  return {
    action,
    relationship,
    goal,
    sourceSession: options.sourceSession ?? {
      coachingSessionId: action.coaching_session_id,
      sessionDate: action.created_at,
    },
    nextSession: options.nextSession ?? null,
    isOverdue: options.isOverdue ?? false,
  };
}

/**
 * Options for creating a mock EnrichedCoachingSession
 */
export interface MockSessionOptions {
  id?: string;
  date: DateTime;
  relationshipId: string;
  coachId?: string;
  coacheeId?: string;
  goalId?: string;
  goalTitle?: string;
}

/**
 * Creates a mock EnrichedCoachingSession for testing.
 *
 * @param options - Configuration for the mock session
 * @returns A partial EnrichedCoachingSession suitable for testing
 */
export function createMockSession(
  options: MockSessionOptions
): Partial<EnrichedCoachingSession> {
  return {
    id: options.id ?? generateTestUUID(),
    date: options.date.toISO() ?? "",
    coaching_relationship_id: options.relationshipId,
    relationship: {
      id: options.relationshipId,
      coach_id: options.coachId ?? TEST_USER_IDS.COACH,
      coachee_id: options.coacheeId ?? TEST_USER_IDS.COACHEE,
      organization_id: generateTestUUID(),
    },
    coach: {
      id: options.coachId ?? TEST_USER_IDS.COACH,
      first_name: "Coach",
      last_name: "Name",
      email: "coach@test.com",
      display_name: "Coach Name",
    },
    coachee: {
      id: options.coacheeId ?? TEST_USER_IDS.COACHEE,
      first_name: "Coachee",
      last_name: "Name",
      email: "coachee@test.com",
      display_name: "Coachee Name",
    },
    goal: options.goalId
      ? {
          id: options.goalId,
          title: options.goalTitle ?? "Test Goal",
          user_id: options.coacheeId ?? TEST_USER_IDS.COACHEE,
          coaching_session_id: options.id ?? TEST_SESSION_IDS.SESSION_1,
          status: ItemStatus.InProgress,
          status_changed_at: DateTime.now(),
          created_at: DateTime.now(),
          updated_at: DateTime.now(),
        }
      : undefined,
  };
}

// ============================================================================
// Shared Filter Functions (extracted for testing)
// ============================================================================

/**
 * Counts actions due by a specific session date for a given relationship.
 * This mirrors the logic in TodaySessionCard.
 *
 * @param assignedActions - Array of actions with context
 * @param sessionRelationshipId - The coaching_relationship_id of the session
 * @param sessionDate - The DateTime of the session
 * @returns Count of actions matching both criteria
 */
export function countActionsDueBySession(
  assignedActions: AssignedActionWithContext[],
  sessionRelationshipId: string,
  sessionDate: DateTime
): number {
  return assignedActions.filter((a) => {
    if (a.relationship.id !== sessionRelationshipId) {
      return false;
    }
    return a.action.due_by <= sessionDate;
  }).length;
}

/**
 * Calculates whether an action is overdue.
 * This mirrors the logic in useAssignedActions.
 *
 * @param dueBy - The action's due date
 * @param referenceDate - The date to compare against (defaults to today)
 * @returns True if the action is overdue
 */
export function isActionOverdue(
  dueBy: DateTime,
  referenceDate: DateTime = DateTime.now()
): boolean {
  const today = referenceDate.startOf("day");
  const dueDate = dueBy.startOf("day");
  return dueDate < today;
}

/**
 * Filters actions by status for the ActionsSummary component.
 * This mirrors the filterActionsByStatus logic in useAssignedActions.
 *
 * @param actions - Raw actions to filter
 * @param filter - The filter type (due_soon, all_incomplete, all_unassigned)
 * @param userId - The current user's ID
 * @returns Filtered actions
 */
export function filterActionsByAssignedStatus(
  actions: Action[],
  filter: "due_soon" | "all_incomplete" | "all_unassigned",
  userId: string
): Action[] {
  return actions.filter((action) => {
    // Only include incomplete actions
    if (action.status === ItemStatus.Completed) return false;

    if (filter === "all_unassigned") {
      return !action.assignee_ids || action.assignee_ids.length === 0;
    }

    // For due_soon and all_incomplete, only show actions assigned to user
    const isAssignedToUser = action.assignee_ids?.includes(userId);
    if (!isAssignedToUser) return false;

    if (filter === "all_incomplete") {
      return true;
    }

    // For due_soon, the actual filtering requires session context
    // which is handled at a higher level
    return true;
  });
}

/**
 * Filters completed actions that were completed since the last session.
 * This mirrors the filterActionsByStatus logic for the "completed" filter.
 *
 * @param actions - Raw actions to filter
 * @param userId - The current user's ID
 * @param lastSessionDate - The date of the last session (null if no previous session)
 * @returns Filtered actions (completed, assigned to user, completed after last session)
 */
export function filterCompletedActionsSinceLastSession(
  actions: Action[],
  userId: string,
  lastSessionDate: DateTime | null
): Action[] {
  return actions.filter((action) => {
    // Only include completed actions
    if (action.status !== ItemStatus.Completed) return false;

    // Must be assigned to user
    const isAssignedToUser = action.assignee_ids?.includes(userId);
    if (!isAssignedToUser) return false;

    // If no last session, include all completed actions for this user
    if (!lastSessionDate) return true;

    // Include actions completed after the last session
    return action.status_changed_at >= lastSessionDate;
  });
}

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generates a set of actions with various due dates relative to a reference date.
 * Useful for testing date filtering scenarios.
 *
 * @param relationshipId - The relationship these actions belong to
 * @param referenceDate - The date to create actions relative to
 * @returns Object with actions at different time offsets
 */
export function generateDateRelativeActions(
  relationshipId: string,
  referenceDate: DateTime
) {
  return {
    weekBefore: createMockAssignedAction({
      id: generateTestUUID(),
      relationshipId,
      dueBy: referenceDate.minus({ days: 7 }),
    }),
    dayBefore: createMockAssignedAction({
      id: generateTestUUID(),
      relationshipId,
      dueBy: referenceDate.minus({ days: 1 }),
    }),
    hourBefore: createMockAssignedAction({
      id: generateTestUUID(),
      relationshipId,
      dueBy: referenceDate.minus({ hours: 1 }),
    }),
    exactTime: createMockAssignedAction({
      id: generateTestUUID(),
      relationshipId,
      dueBy: referenceDate,
    }),
    hourAfter: createMockAssignedAction({
      id: generateTestUUID(),
      relationshipId,
      dueBy: referenceDate.plus({ hours: 1 }),
    }),
    dayAfter: createMockAssignedAction({
      id: generateTestUUID(),
      relationshipId,
      dueBy: referenceDate.plus({ days: 1 }),
    }),
    weekAfter: createMockAssignedAction({
      id: generateTestUUID(),
      relationshipId,
      dueBy: referenceDate.plus({ days: 7 }),
    }),
  };
}
