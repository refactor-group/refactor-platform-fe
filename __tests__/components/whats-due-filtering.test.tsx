/**
 * Tests for What's Due Component Filtering and Overdue Calculation
 *
 * These tests verify the logic used in the What's Due dashboard component for:
 * 1. Determining if an action is overdue (comparing due_by to today)
 * 2. Filtering actions by status (DueSoon, AllIncomplete, AllUnassigned)
 * 3. Filtering actions by assignment (assigned to user vs unassigned)
 *
 * The What's Due component is critical for helping users prioritize their work.
 * Incorrect overdue calculations or filtering could cause users to miss deadlines
 * or waste time on incorrect priorities.
 *
 * CRITICAL: The isOverdue calculation uses date-only comparison (startOf("day"))
 * to avoid marking items due later today as overdue. This is different from the
 * TodaySessionCard which uses full datetime comparison.
 */

import { DateTime } from "ts-luxon";
import {
  createMockAction,
  createMockAssignedAction,
  createMockSession,
  isActionOverdue,
  filterActionsByAssignedStatus,
  TEST_RELATIONSHIP_IDS,
  TEST_USER_IDS,
  TEST_SESSION_IDS,
  REFERENCE_DATE,
  generateTestUUID,
} from "../utils/action-test-utils";
import { ItemStatus } from "@/types/general";
import { filterActionsByStatus } from "@/lib/hooks/use-assigned-actions";
import { AssignedActionsFilter } from "@/types/assigned-actions";
import type { EnrichedCoachingSession } from "@/types/coaching-session";

describe("What's Due Filtering", () => {
  /**
   * =========================================================================
   * OVERDUE CALCULATION TESTS
   * =========================================================================
   *
   * These tests verify the isOverdue calculation logic.
   * The rule is: action is overdue if due_by.startOf("day") < today.startOf("day")
   *
   * Key difference from TodaySessionCard: This compares DATES only, not times.
   * An action due at 9 AM today is NOT overdue even if it's now 5 PM.
   */
  describe("isOverdue calculation", () => {
    /**
     * Test: Actions due in the past should be marked as overdue.
     *
     * Purpose: Verify that actions with due dates before today are correctly
     * identified as overdue. These need immediate attention.
     *
     * Strategy: Create actions with due dates 1 day, 1 week, and 1 month
     * before the reference date. All should be marked overdue.
     */
    it("should mark actions due BEFORE today as overdue", () => {
      const today = REFERENCE_DATE;

      // Action due yesterday
      expect(isActionOverdue(today.minus({ days: 1 }), today)).toBe(true);

      // Action due a week ago
      expect(isActionOverdue(today.minus({ days: 7 }), today)).toBe(true);

      // Action due a month ago
      expect(isActionOverdue(today.minus({ months: 1 }), today)).toBe(true);
    });

    /**
     * Test: Actions due today should NOT be marked as overdue.
     *
     * Purpose: Verify that actions due on the current day are not overdue,
     * regardless of the time of day. Users should have until end of day.
     *
     * Strategy: Create actions due at various times today (midnight, morning,
     * afternoon, evening). None should be marked overdue.
     */
    it("should NOT mark actions due TODAY as overdue (regardless of time)", () => {
      const today = REFERENCE_DATE; // 2:00 PM

      // Due at midnight today
      expect(isActionOverdue(today.startOf("day"), today)).toBe(false);

      // Due at 9 AM today (before reference time)
      expect(isActionOverdue(today.minus({ hours: 5 }), today)).toBe(false);

      // Due at exactly reference time
      expect(isActionOverdue(today, today)).toBe(false);

      // Due at 6 PM today (after reference time)
      expect(isActionOverdue(today.plus({ hours: 4 }), today)).toBe(false);

      // Due at 11:59 PM today
      expect(isActionOverdue(today.endOf("day"), today)).toBe(false);
    });

    /**
     * Test: Actions due in the future should NOT be marked as overdue.
     *
     * Purpose: Verify that future-dated actions are not marked overdue.
     * These are upcoming tasks, not urgent ones.
     *
     * Strategy: Create actions due 1 day, 1 week, and 1 month in the future.
     * None should be marked overdue.
     */
    it("should NOT mark actions due in the FUTURE as overdue", () => {
      const today = REFERENCE_DATE;

      // Due tomorrow
      expect(isActionOverdue(today.plus({ days: 1 }), today)).toBe(false);

      // Due next week
      expect(isActionOverdue(today.plus({ days: 7 }), today)).toBe(false);

      // Due next month
      expect(isActionOverdue(today.plus({ months: 1 }), today)).toBe(false);
    });

    /**
     * Test: Midnight boundary between days is handled correctly.
     *
     * Purpose: Verify that the transition from one day to the next doesn't
     * cause incorrect overdue calculations. This is a common edge case.
     *
     * Strategy: Use a reference time just after midnight (12:01 AM) and
     * verify that 11:59 PM the previous day is overdue, while 12:00 AM
     * same day is not.
     */
    it("should handle midnight boundary correctly", () => {
      // Reference time: 12:01 AM on January 15 (use UTC zone to avoid local tz conversion)
      const justAfterMidnight = DateTime.fromISO("2026-01-15T00:01:00.000Z", { zone: "utc" });

      // Due at 11:59 PM on January 14 (yesterday) - should be overdue
      const duePreviousNight = DateTime.fromISO("2026-01-14T23:59:00.000Z", { zone: "utc" });
      expect(isActionOverdue(duePreviousNight, justAfterMidnight)).toBe(true);

      // Due at 12:00 AM on January 15 (today) - should NOT be overdue
      const dueMidnightToday = DateTime.fromISO("2026-01-15T00:00:00.000Z", { zone: "utc" });
      expect(isActionOverdue(dueMidnightToday, justAfterMidnight)).toBe(false);

      // Due at 12:01 AM on January 15 (same time) - should NOT be overdue
      expect(isActionOverdue(justAfterMidnight, justAfterMidnight)).toBe(false);
    });

    /**
     * Test: End of day on due date is handled correctly.
     *
     * Purpose: Verify that checking at the very end of a day doesn't
     * incorrectly mark that day's items as overdue.
     *
     * Strategy: Use a reference time at 11:59 PM and verify that items
     * due that same day are not marked overdue.
     */
    it("should handle end of day correctly", () => {
      // Reference time: 11:59 PM on January 15
      const endOfDay = DateTime.fromISO("2026-01-15T23:59:00.000Z");

      // Due at 9 AM same day - should NOT be overdue (same day)
      const dueEarlierToday = DateTime.fromISO("2026-01-15T09:00:00.000Z");
      expect(isActionOverdue(dueEarlierToday, endOfDay)).toBe(false);

      // Due at 11:59 PM same day - should NOT be overdue (same day)
      expect(isActionOverdue(endOfDay, endOfDay)).toBe(false);

      // Due at 12:00 AM next day - should NOT be overdue (tomorrow)
      const dueTomorrow = DateTime.fromISO("2026-01-16T00:00:00.000Z");
      expect(isActionOverdue(dueTomorrow, endOfDay)).toBe(false);
    });

    /**
     * Test: Very old overdue items are still marked correctly.
     *
     * Purpose: Verify that items overdue for a long time are still correctly
     * identified. Users might have very old incomplete items.
     *
     * Strategy: Create an action due 1 year ago and verify it's marked overdue.
     */
    it("should mark very old overdue items correctly", () => {
      const today = REFERENCE_DATE;

      // Due 1 year ago
      expect(isActionOverdue(today.minus({ years: 1 }), today)).toBe(true);

      // Due 5 years ago
      expect(isActionOverdue(today.minus({ years: 5 }), today)).toBe(true);
    });
  });

  /**
   * =========================================================================
   * ACTION STATUS FILTERING TESTS
   * =========================================================================
   *
   * These tests verify the filtering logic for different filter modes:
   * - DueSoon: Actions assigned to user, incomplete, due before next session
   * - AllIncomplete: All incomplete actions assigned to user
   * - AllUnassigned: Actions with no assignees
   */
  describe("action status filtering", () => {
    /**
     * Test: Completed actions are always excluded.
     *
     * Purpose: Verify that completed actions are filtered out regardless
     * of the filter mode. The What's Due card only shows actionable items.
     *
     * Strategy: Create both completed and incomplete actions, verify only
     * incomplete ones are returned for each filter type.
     */
    it("should exclude completed actions from all filters", () => {
      const actions = [
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.minus({ days: 1 }),
          status: ItemStatus.Completed,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.minus({ days: 1 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.minus({ days: 1 }),
          status: ItemStatus.InProgress,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
      ];

      // All filters should exclude the completed action
      const dueSoonResults = filterActionsByAssignedStatus(
        actions,
        "due_soon",
        TEST_USER_IDS.CURRENT_USER
      );
      expect(dueSoonResults).toHaveLength(2);

      const allIncompleteResults = filterActionsByAssignedStatus(
        actions,
        "all_incomplete",
        TEST_USER_IDS.CURRENT_USER
      );
      expect(allIncompleteResults).toHaveLength(2);
    });

    /**
     * Test: AllIncomplete filter returns all incomplete actions assigned to user.
     *
     * Purpose: Verify that the AllIncomplete filter includes NotStarted and
     * InProgress actions that are assigned to the current user.
     *
     * Strategy: Create actions with various statuses and assignees, verify
     * only incomplete actions assigned to the user are returned.
     */
    it("should filter by assignment for all_incomplete", () => {
      const actions = [
        // Assigned to current user, incomplete - should be included
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 7 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        // Assigned to current user, in progress - should be included
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 7 }),
          status: ItemStatus.InProgress,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        // Assigned to someone else - should be excluded
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 7 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.OTHER_USER],
        }),
        // Unassigned - should be excluded
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 7 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [],
        }),
      ];

      const results = filterActionsByAssignedStatus(
        actions,
        "all_incomplete",
        TEST_USER_IDS.CURRENT_USER
      );

      expect(results).toHaveLength(2);
      expect(results.every((a) => a.assignee_ids?.includes(TEST_USER_IDS.CURRENT_USER))).toBe(true);
    });

    /**
     * Test: AllUnassigned filter returns only unassigned actions.
     *
     * Purpose: Verify that the AllUnassigned filter shows actions that have
     * no assignees. These are items that need someone to take ownership.
     *
     * Strategy: Create a mix of assigned and unassigned actions, verify
     * only unassigned ones are returned.
     */
    it("should return only unassigned actions for all_unassigned filter", () => {
      const actions = [
        // Assigned to current user - should be excluded
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 7 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        // Assigned to someone else - should be excluded
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 7 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.OTHER_USER],
        }),
        // Unassigned (empty array) - should be included
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 7 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [],
        }),
      ];

      const results = filterActionsByAssignedStatus(
        actions,
        "all_unassigned",
        TEST_USER_IDS.CURRENT_USER
      );

      expect(results).toHaveLength(1);
      expect(results.every((a) => !a.assignee_ids || a.assignee_ids.length === 0)).toBe(true);
    });

    /**
     * Test: Actions assigned to multiple users including current user are included.
     *
     * Purpose: Verify that actions assigned to multiple people (including the
     * current user) are correctly included in user-filtered results.
     *
     * Strategy: Create an action assigned to both current user and another
     * user, verify it's included in the filtered results.
     */
    it("should include actions assigned to multiple users including current user", () => {
      const actions = [
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 7 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER, TEST_USER_IDS.OTHER_USER],
        }),
      ];

      const results = filterActionsByAssignedStatus(
        actions,
        "all_incomplete",
        TEST_USER_IDS.CURRENT_USER
      );

      expect(results).toHaveLength(1);
    });
  });

  /**
   * =========================================================================
   * EDGE CASE TESTS
   * =========================================================================
   *
   * These tests verify correct behavior for boundary conditions and unusual
   * scenarios that might occur in production.
   */
  describe("edge cases", () => {
    /**
     * Test: Empty actions array returns empty results.
     *
     * Purpose: Verify graceful handling when user has no actions.
     *
     * Strategy: Pass an empty array to each filter, verify empty results.
     */
    it("should return empty array for empty input", () => {
      expect(
        filterActionsByAssignedStatus([], "due_soon", TEST_USER_IDS.CURRENT_USER)
      ).toEqual([]);

      expect(
        filterActionsByAssignedStatus([], "all_incomplete", TEST_USER_IDS.CURRENT_USER)
      ).toEqual([]);

      expect(
        filterActionsByAssignedStatus([], "all_unassigned", TEST_USER_IDS.CURRENT_USER)
      ).toEqual([]);
    });

    /**
     * Test: Actions with null assignee_ids are treated as unassigned.
     *
     * Purpose: Verify that actions where assignee_ids might be null or
     * undefined are handled correctly and treated as unassigned.
     *
     * Strategy: Create action with various falsy assignee values, verify
     * they appear in unassigned filter but not user-assigned filters.
     */
    it("should handle null/undefined assignee_ids as unassigned", () => {
      const actionWithNull = {
        ...createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 7 }),
          status: ItemStatus.NotStarted,
        }),
        assignee_ids: null as unknown as string[],
      };

      const actionWithUndefined = {
        ...createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 7 }),
          status: ItemStatus.NotStarted,
        }),
        assignee_ids: undefined,
      };

      const actions = [actionWithNull, actionWithUndefined];

      // Should appear in unassigned filter
      const unassignedResults = filterActionsByAssignedStatus(
        actions,
        "all_unassigned",
        TEST_USER_IDS.CURRENT_USER
      );
      expect(unassignedResults).toHaveLength(2);

      // Should NOT appear in user-assigned filters
      const incompleteResults = filterActionsByAssignedStatus(
        actions,
        "all_incomplete",
        TEST_USER_IDS.CURRENT_USER
      );
      expect(incompleteResults).toHaveLength(0);
    });

    /**
     * Test: All action statuses are handled correctly.
     *
     * Purpose: Verify that all possible ItemStatus values are handled
     * correctly by the filtering logic.
     *
     * Strategy: Create actions with each status, verify filtering behavior.
     */
    it("should handle all action statuses correctly", () => {
      const actions = [
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE,
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE,
          status: ItemStatus.InProgress,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE,
          status: ItemStatus.Completed,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
      ];

      const results = filterActionsByAssignedStatus(
        actions,
        "all_incomplete",
        TEST_USER_IDS.CURRENT_USER
      );

      // NotStarted and InProgress should be included, Completed excluded
      expect(results).toHaveLength(2);
      expect(results.some((a) => a.status === ItemStatus.NotStarted)).toBe(true);
      expect(results.some((a) => a.status === ItemStatus.InProgress)).toBe(true);
      expect(results.some((a) => a.status === ItemStatus.Completed)).toBe(false);
    });
  });

  /**
   * =========================================================================
   * REALISTIC SCENARIO TESTS
   * =========================================================================
   *
   * These tests simulate real-world usage patterns to ensure the logic
   * works correctly in production-like conditions.
   */
  describe("realistic scenarios", () => {
    /**
     * Test: Coach reviewing their action backlog.
     *
     * Purpose: Verify correct behavior in a typical coaching scenario where
     * a coach has multiple actions across different coaching relationships.
     *
     * Strategy: Simulate a coach with:
     * - 2 overdue actions (different relationships)
     * - 3 actions due today
     * - 2 actions due this week
     * - 1 completed action
     * Verify overdue count and filtering work correctly.
     */
    it("should correctly filter a typical coaching backlog", () => {
      const today = REFERENCE_DATE;

      const actions = [
        // Overdue action 1
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: TEST_RELATIONSHIP_IDS.PRIMARY,
          dueBy: today.minus({ days: 3 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        // Overdue action 2 (different relationship)
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: TEST_RELATIONSHIP_IDS.SECONDARY,
          dueBy: today.minus({ days: 1 }),
          status: ItemStatus.InProgress,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        // Due today (morning)
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: TEST_RELATIONSHIP_IDS.PRIMARY,
          dueBy: today.startOf("day").plus({ hours: 9 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        // Due today (evening)
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: TEST_RELATIONSHIP_IDS.SECONDARY,
          dueBy: today.startOf("day").plus({ hours: 18 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        // Due this week
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: TEST_RELATIONSHIP_IDS.PRIMARY,
          dueBy: today.plus({ days: 3 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        // Completed (should be excluded)
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: TEST_RELATIONSHIP_IDS.PRIMARY,
          dueBy: today.minus({ days: 1 }),
          status: ItemStatus.Completed,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
      ];

      // Count overdue actions
      const overdueCount = actions.filter(
        (a) =>
          a.action.status !== ItemStatus.Completed &&
          isActionOverdue(a.action.due_by, today)
      ).length;
      expect(overdueCount).toBe(2);

      // Due today should NOT be overdue
      const dueTodayOverdue = actions.filter(
        (a) =>
          a.action.due_by.hasSame(today, "day") &&
          isActionOverdue(a.action.due_by, today)
      ).length;
      expect(dueTodayOverdue).toBe(0);
    });

    /**
     * Test: Team lead reviewing unassigned actions.
     *
     * Purpose: Verify the unassigned filter works correctly when there are
     * many actions with various assignment states.
     *
     * Strategy: Create a mix of assigned and unassigned actions, verify
     * only unassigned ones appear in the filter.
     */
    it("should correctly identify unassigned actions in a team context", () => {
      const actions = [
        // Assigned to current user
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 1 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        // Assigned to team member
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 1 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.COACH],
        }),
        // Assigned to multiple people
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 1 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER, TEST_USER_IDS.COACHEE],
        }),
        // Unassigned - needs someone to pick it up
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 1 }),
          status: ItemStatus.NotStarted,
          assigneeIds: [],
        }),
        // Unassigned - also needs assignment
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 1 }),
          status: ItemStatus.InProgress,
          assigneeIds: [],
        }),
        // Unassigned but completed - should not show
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE.plus({ days: 1 }),
          status: ItemStatus.Completed,
          assigneeIds: [],
        }),
      ];

      const unassignedResults = filterActionsByAssignedStatus(
        actions,
        "all_unassigned",
        TEST_USER_IDS.CURRENT_USER
      );

      // Should only get 2 unassigned incomplete actions
      expect(unassignedResults).toHaveLength(2);
    });

    /**
     * Test: User with no assigned actions.
     *
     * Purpose: Verify correct behavior when a user has no actions assigned
     * to them, even though actions exist in the system.
     *
     * Strategy: Create actions assigned to other users, verify current user
     * sees 0 in their assigned filters.
     */
    it("should return empty for user with no assigned actions", () => {
      const actions = [
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE,
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.OTHER_USER],
        }),
        createMockAction({
          id: generateTestUUID(),
          dueBy: REFERENCE_DATE,
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.COACH],
        }),
      ];

      const results = filterActionsByAssignedStatus(
        actions,
        "all_incomplete",
        TEST_USER_IDS.CURRENT_USER
      );

      expect(results).toHaveLength(0);
    });
  });

  /**
   * =========================================================================
   * COMPLETED SINCE LAST SESSION FILTER TESTS (Production Code)
   * =========================================================================
   *
   * These tests verify the production filterActionsByStatus function with
   * the Completed filter. This filter shows actions that:
   * 1. Have status = Completed
   * 2. Are assigned to the current user
   * 3. Were completed (status_changed_at) after the last session date
   *
   * If there is no previous session, ALL completed actions for the user
   * should be shown (no time constraint).
   */
  describe("completed since last session filter (production)", () => {
    // Helper to create minimal session map for tests
    const createSessionMap = (sessionId: string, relationshipId: string) => {
      const map = new Map<string, EnrichedCoachingSession>();
      map.set(sessionId, {
        id: sessionId,
        coaching_relationship_id: relationshipId,
        date: REFERENCE_DATE.toISO() ?? "",
      } as EnrichedCoachingSession);
      return map;
    };

    // Helper to create last session map
    const createLastSessionMap = (
      relationshipId: string,
      sessionDate: DateTime | null
    ) => {
      const map = new Map<string, EnrichedCoachingSession>();
      if (sessionDate) {
        map.set(relationshipId, {
          id: generateTestUUID(),
          coaching_relationship_id: relationshipId,
          date: sessionDate.toISO() ?? "",
        } as EnrichedCoachingSession);
      }
      return map;
    };

    /**
     * Test: Only completed actions are included.
     */
    it("should only include completed actions", () => {
      const lastSessionDate = REFERENCE_DATE.minus({ days: 7 });
      const sessionMap = createSessionMap(
        TEST_SESSION_IDS.SESSION_1,
        TEST_RELATIONSHIP_IDS.PRIMARY
      );
      const lastSessionMap = createLastSessionMap(
        TEST_RELATIONSHIP_IDS.PRIMARY,
        lastSessionDate
      );

      const actions = [
        createMockAction({
          id: generateTestUUID(),
          coachingSessionId: TEST_SESSION_IDS.SESSION_1,
          dueBy: REFERENCE_DATE,
          status: ItemStatus.Completed,
          statusChangedAt: REFERENCE_DATE.minus({ days: 3 }),
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        createMockAction({
          id: generateTestUUID(),
          coachingSessionId: TEST_SESSION_IDS.SESSION_1,
          dueBy: REFERENCE_DATE,
          status: ItemStatus.NotStarted,
          statusChangedAt: REFERENCE_DATE.minus({ days: 3 }),
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        createMockAction({
          id: generateTestUUID(),
          coachingSessionId: TEST_SESSION_IDS.SESSION_1,
          dueBy: REFERENCE_DATE,
          status: ItemStatus.InProgress,
          statusChangedAt: REFERENCE_DATE.minus({ days: 3 }),
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
      ];

      const results = filterActionsByStatus(
        actions,
        AssignedActionsFilter.Completed,
        TEST_USER_IDS.CURRENT_USER,
        sessionMap,
        new Map(), // nextSessionByRelationship not used for Completed filter
        lastSessionMap
      );

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe(ItemStatus.Completed);
    });

    /**
     * Test: Only actions assigned to user are included.
     */
    it("should only include actions assigned to the current user", () => {
      const lastSessionDate = REFERENCE_DATE.minus({ days: 7 });
      const sessionMap = createSessionMap(
        TEST_SESSION_IDS.SESSION_1,
        TEST_RELATIONSHIP_IDS.PRIMARY
      );
      const lastSessionMap = createLastSessionMap(
        TEST_RELATIONSHIP_IDS.PRIMARY,
        lastSessionDate
      );

      const actions = [
        // Assigned to current user - should be included
        createMockAction({
          id: generateTestUUID(),
          coachingSessionId: TEST_SESSION_IDS.SESSION_1,
          dueBy: REFERENCE_DATE,
          status: ItemStatus.Completed,
          statusChangedAt: REFERENCE_DATE.minus({ days: 3 }),
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        // Assigned to other user - should be excluded
        createMockAction({
          id: generateTestUUID(),
          coachingSessionId: TEST_SESSION_IDS.SESSION_1,
          dueBy: REFERENCE_DATE,
          status: ItemStatus.Completed,
          statusChangedAt: REFERENCE_DATE.minus({ days: 3 }),
          assigneeIds: [TEST_USER_IDS.OTHER_USER],
        }),
        // Unassigned - should be excluded
        createMockAction({
          id: generateTestUUID(),
          coachingSessionId: TEST_SESSION_IDS.SESSION_1,
          dueBy: REFERENCE_DATE,
          status: ItemStatus.Completed,
          statusChangedAt: REFERENCE_DATE.minus({ days: 3 }),
          assigneeIds: [],
        }),
      ];

      const results = filterActionsByStatus(
        actions,
        AssignedActionsFilter.Completed,
        TEST_USER_IDS.CURRENT_USER,
        sessionMap,
        new Map(),
        lastSessionMap
      );

      expect(results).toHaveLength(1);
      expect(results[0].assignee_ids).toContain(TEST_USER_IDS.CURRENT_USER);
    });

    /**
     * Test: Only actions completed after last session are included.
     */
    it("should only include actions completed after the last session", () => {
      const lastSessionDate = REFERENCE_DATE.minus({ days: 7 });
      const sessionMap = createSessionMap(
        TEST_SESSION_IDS.SESSION_1,
        TEST_RELATIONSHIP_IDS.PRIMARY
      );
      const lastSessionMap = createLastSessionMap(
        TEST_RELATIONSHIP_IDS.PRIMARY,
        lastSessionDate
      );

      const actions = [
        // Completed 3 days ago (after last session) - should be included
        createMockAction({
          id: generateTestUUID(),
          body: "Completed after session",
          coachingSessionId: TEST_SESSION_IDS.SESSION_1,
          dueBy: REFERENCE_DATE,
          status: ItemStatus.Completed,
          statusChangedAt: REFERENCE_DATE.minus({ days: 3 }),
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        // Completed 10 days ago (before last session) - should be excluded
        createMockAction({
          id: generateTestUUID(),
          body: "Completed before session",
          coachingSessionId: TEST_SESSION_IDS.SESSION_1,
          dueBy: REFERENCE_DATE,
          status: ItemStatus.Completed,
          statusChangedAt: REFERENCE_DATE.minus({ days: 10 }),
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        // Completed exactly at last session time - should be included (>=)
        createMockAction({
          id: generateTestUUID(),
          body: "Completed at session time",
          coachingSessionId: TEST_SESSION_IDS.SESSION_1,
          dueBy: REFERENCE_DATE,
          status: ItemStatus.Completed,
          statusChangedAt: lastSessionDate,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
      ];

      const results = filterActionsByStatus(
        actions,
        AssignedActionsFilter.Completed,
        TEST_USER_IDS.CURRENT_USER,
        sessionMap,
        new Map(),
        lastSessionMap
      );

      expect(results).toHaveLength(2);
      expect(results.map((a) => a.body)).toContain("Completed after session");
      expect(results.map((a) => a.body)).toContain("Completed at session time");
      expect(results.map((a) => a.body)).not.toContain("Completed before session");
    });

    /**
     * Test: All completed actions shown when no previous session exists.
     */
    it("should include all completed actions when no previous session exists", () => {
      const sessionMap = createSessionMap(
        TEST_SESSION_IDS.SESSION_1,
        TEST_RELATIONSHIP_IDS.PRIMARY
      );
      // Empty map = no previous session
      const lastSessionMap = new Map<string, EnrichedCoachingSession>();

      const actions = [
        // Completed long ago - should still be included
        createMockAction({
          id: generateTestUUID(),
          body: "Old completion",
          coachingSessionId: TEST_SESSION_IDS.SESSION_1,
          dueBy: REFERENCE_DATE,
          status: ItemStatus.Completed,
          statusChangedAt: REFERENCE_DATE.minus({ months: 6 }),
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        // Completed recently - should be included
        createMockAction({
          id: generateTestUUID(),
          body: "Recent completion",
          coachingSessionId: TEST_SESSION_IDS.SESSION_1,
          dueBy: REFERENCE_DATE,
          status: ItemStatus.Completed,
          statusChangedAt: REFERENCE_DATE.minus({ days: 1 }),
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        // Not completed - should still be excluded
        createMockAction({
          id: generateTestUUID(),
          body: "Not completed",
          coachingSessionId: TEST_SESSION_IDS.SESSION_1,
          dueBy: REFERENCE_DATE,
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
      ];

      const results = filterActionsByStatus(
        actions,
        AssignedActionsFilter.Completed,
        TEST_USER_IDS.CURRENT_USER,
        sessionMap,
        new Map(),
        lastSessionMap
      );

      expect(results).toHaveLength(2);
      expect(results.map((a) => a.body)).toContain("Old completion");
      expect(results.map((a) => a.body)).toContain("Recent completion");
    });

    /**
     * Test: Empty result when no completed actions exist.
     */
    it("should return empty array when no completed actions exist", () => {
      const lastSessionDate = REFERENCE_DATE.minus({ days: 7 });
      const sessionMap = createSessionMap(
        TEST_SESSION_IDS.SESSION_1,
        TEST_RELATIONSHIP_IDS.PRIMARY
      );
      const lastSessionMap = createLastSessionMap(
        TEST_RELATIONSHIP_IDS.PRIMARY,
        lastSessionDate
      );

      const actions = [
        createMockAction({
          id: generateTestUUID(),
          coachingSessionId: TEST_SESSION_IDS.SESSION_1,
          dueBy: REFERENCE_DATE,
          status: ItemStatus.NotStarted,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
        createMockAction({
          id: generateTestUUID(),
          coachingSessionId: TEST_SESSION_IDS.SESSION_1,
          dueBy: REFERENCE_DATE,
          status: ItemStatus.InProgress,
          assigneeIds: [TEST_USER_IDS.CURRENT_USER],
        }),
      ];

      const results = filterActionsByStatus(
        actions,
        AssignedActionsFilter.Completed,
        TEST_USER_IDS.CURRENT_USER,
        sessionMap,
        new Map(),
        lastSessionMap
      );

      expect(results).toHaveLength(0);
    });
  });
});
