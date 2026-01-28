/**
 * Tests for TodaySessionCard Actions Due Count Calculation
 *
 * These tests verify the logic that counts how many actions are due by a specific
 * coaching session. This count appears on each session card to help users understand
 * their preparation workload before a meeting.
 *
 * The filtering logic must satisfy two criteria:
 * 1. The action must belong to the same coaching relationship as the session
 * 2. The action's due_by date must be on or before the session date/time
 *
 * CRITICAL: These calculations directly impact user experience and trust in the system.
 * Incorrect counts could lead to missed deadlines or unnecessary stress.
 */

import { DateTime } from "ts-luxon";
import {
  createMockAssignedAction,
  countActionsDueBySession,
  TEST_RELATIONSHIP_IDS,
  REFERENCE_DATE,
  generateTestUUID,
} from "../utils/action-test-utils";

describe("TodaySessionCard Actions Due Count", () => {
  // Use standard test constants for consistency
  const SESSION_RELATIONSHIP_ID = TEST_RELATIONSHIP_IDS.PRIMARY;
  const DIFFERENT_RELATIONSHIP_ID = TEST_RELATIONSHIP_IDS.SECONDARY;

  // Reference session date from shared constants
  const SESSION_DATE = REFERENCE_DATE;

  /**
   * =========================================================================
   * DUE DATE FILTERING TESTS
   * =========================================================================
   *
   * These tests verify that the due_by date comparison works correctly.
   * The rule is: action.due_by <= sessionDate (inclusive comparison)
   */
  describe("due_by date filtering", () => {
    /**
     * Test: Actions due well before the session should be counted.
     *
     * Purpose: Verify that actions with due dates in the past (relative to
     * the session) are included in the count. These represent overdue items
     * the user should address before their meeting.
     *
     * Strategy: Create actions with due dates 7 days and 1 day before the
     * session, then verify both are counted.
     */
    it("should count actions due BEFORE the session date", () => {
      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.minus({ days: 7 }), // Due 1 week before
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.minus({ days: 1 }), // Due 1 day before
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        SESSION_DATE
      );
      expect(count).toBe(2);
    });

    /**
     * Test: Actions due earlier on the same day should be counted.
     *
     * Purpose: Verify that time-of-day matters for the comparison. An action
     * due at 12 PM should count toward a 2 PM session on the same day.
     *
     * Strategy: Create an action due 2 hours before the session time and
     * verify it's included.
     */
    it("should count actions due ON the session date (same day, earlier time)", () => {
      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.minus({ hours: 2 }), // Due 2 hours before session
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        SESSION_DATE
      );
      expect(count).toBe(1);
    });

    /**
     * Test: Actions due at the exact session time should be counted.
     *
     * Purpose: Verify the boundary condition where due_by equals session date
     * exactly. The <= comparison should include this case.
     *
     * Strategy: Create an action with due_by exactly matching the session
     * DateTime and verify it's counted.
     */
    it("should count actions due ON the session date (exact same time)", () => {
      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE, // Due exactly at session time
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        SESSION_DATE
      );
      expect(count).toBe(1);
    });

    /**
     * Test: Actions due later on the same day should NOT be counted.
     *
     * Purpose: Verify that actions due after the session time (even on the
     * same calendar day) are excluded. Users shouldn't see actions they
     * don't need to complete before this specific session.
     *
     * Strategy: Create an action due 2 hours after the session and verify
     * it's excluded from the count.
     */
    it("should NOT count actions due ON the session date but AFTER session time", () => {
      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.plus({ hours: 2 }), // Due 2 hours after session
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        SESSION_DATE
      );
      expect(count).toBe(0);
    });

    /**
     * Test: Actions due after the session date should NOT be counted.
     *
     * Purpose: Verify that future-dated actions are excluded. These don't
     * require attention before this session.
     *
     * Strategy: Create actions due 1 day and 1 week after the session,
     * verify neither is counted.
     */
    it("should NOT count actions due AFTER the session date", () => {
      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.plus({ days: 1 }), // Due 1 day after
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.plus({ weeks: 1 }), // Due 1 week after
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        SESSION_DATE
      );
      expect(count).toBe(0);
    });

    /**
     * Test: Mixed due dates should be filtered correctly.
     *
     * Purpose: Verify the filter works correctly when actions have a variety
     * of due dates spanning before, on, and after the session.
     *
     * Strategy: Create 5 actions with different due dates (2 before, 1 exact,
     * 2 after) and verify only the first 3 are counted.
     */
    it("should handle mix of due dates (before, on, and after)", () => {
      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.minus({ days: 30 }), // Due 30 days before
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.minus({ hours: 1 }), // Due 1 hour before
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE, // Due exactly at session
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.plus({ hours: 1 }), // Due 1 hour after
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.plus({ days: 7 }), // Due 1 week after
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        SESSION_DATE
      );
      expect(count).toBe(3); // first 3 actions
    });
  });

  /**
   * =========================================================================
   * RELATIONSHIP FILTERING TESTS
   * =========================================================================
   *
   * These tests verify that actions are correctly filtered by coaching
   * relationship. Each session card should only show actions relevant to
   * that specific coach-coachee relationship.
   */
  describe("relationship filtering", () => {
    /**
     * Test: Only actions for the matching relationship should be counted.
     *
     * Purpose: Verify that the relationship filter correctly isolates actions.
     * A coach may have multiple coachees, and each session card should only
     * show relevant actions.
     *
     * Strategy: Create two actions with the same due date but different
     * relationships, verify only the matching one is counted.
     */
    it("should only count actions for the matching relationship", () => {
      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.minus({ days: 1 }),
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: DIFFERENT_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.minus({ days: 1 }),
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        SESSION_DATE
      );
      expect(count).toBe(1);
    });

    /**
     * Test: Return 0 when no actions match the relationship.
     *
     * Purpose: Verify correct behavior when the user has actions but none
     * for the displayed session's relationship.
     *
     * Strategy: Create actions for different relationships only, verify
     * count is 0 for the target relationship.
     */
    it("should return 0 when no actions match the relationship", () => {
      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: DIFFERENT_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.minus({ days: 1 }),
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: TEST_RELATIONSHIP_IDS.TERTIARY,
          dueBy: SESSION_DATE.minus({ days: 1 }),
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        SESSION_DATE
      );
      expect(count).toBe(0);
    });

    /**
     * Test: Combined relationship and due date filtering works correctly.
     *
     * Purpose: Verify that both filters are applied together. An action must
     * match BOTH the relationship AND be due by the session to be counted.
     *
     * Strategy: Create a matrix of actions (2 relationships x 2 due date
     * scenarios) and verify only the one matching both criteria is counted.
     */
    it("should handle multiple relationships with mixed due dates", () => {
      const actions = [
        // Same relationship - due before (should count)
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.minus({ days: 1 }),
        }),
        // Same relationship - due after (should NOT count)
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.plus({ days: 1 }),
        }),
        // Different relationship - due before (should NOT count - wrong relationship)
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: DIFFERENT_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.minus({ days: 1 }),
        }),
        // Different relationship - due after (should NOT count)
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: DIFFERENT_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.plus({ days: 1 }),
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        SESSION_DATE
      );
      expect(count).toBe(1);
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
     * Test: Empty actions array returns 0.
     *
     * Purpose: Verify graceful handling when user has no actions at all.
     * This is a common case for new users or after completing all tasks.
     *
     * Strategy: Pass an empty array, verify count is 0 (not undefined/NaN).
     */
    it("should return 0 for empty actions array", () => {
      const count = countActionsDueBySession(
        [],
        SESSION_RELATIONSHIP_ID,
        SESSION_DATE
      );
      expect(count).toBe(0);
    });

    /**
     * Test: Actions created long ago but due by session are counted.
     *
     * Purpose: Verify that created_at date does not affect the count.
     * Only due_by matters for determining if an action needs attention.
     *
     * Strategy: Create an action from 6 months ago that's due before the
     * session, verify it's counted.
     */
    it("should handle actions created long before session but due by session", () => {
      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.minus({ days: 1 }),
          createdAt: SESSION_DATE.minus({ months: 6 }), // Created 6 months ago
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        SESSION_DATE
      );
      expect(count).toBe(1);
    });

    /**
     * Test: Recently created actions due by session are counted.
     *
     * Purpose: Verify that very recently created actions are included.
     * A coach might create an action right before a session.
     *
     * Strategy: Create an action from 1 hour ago due at the session time,
     * verify it's counted.
     */
    it("should handle actions created shortly before session and due by session", () => {
      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE,
          createdAt: SESSION_DATE.minus({ hours: 1 }), // Created 1 hour before session
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        SESSION_DATE
      );
      expect(count).toBe(1);
    });

    /**
     * Test: Actions created on session day with earlier due time are counted.
     *
     * Purpose: Verify same-day created actions work correctly. This tests
     * the scenario where someone creates an action the morning of a session.
     *
     * Strategy: Create action at midnight of session day, due 2 hours before
     * the session, verify it's counted.
     */
    it("should handle actions created ON session date with due date before session", () => {
      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.minus({ hours: 2 }),
          createdAt: SESSION_DATE.startOf("day"), // Created at midnight of session day
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        SESSION_DATE
      );
      expect(count).toBe(1);
    });

    /**
     * Test: Anomalous data (created after session) still filters by due_by.
     *
     * Purpose: Verify robustness against data anomalies. While actions
     * shouldn't be created after their due date, the system should handle
     * this gracefully.
     *
     * Strategy: Create an action with created_at after session but due_by
     * before session. Should still count based on due_by.
     */
    it("should handle actions created AFTER session date (edge case)", () => {
      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: SESSION_DATE.minus({ days: 1 }), // Due before session
          createdAt: SESSION_DATE.plus({ days: 1 }), // Created after session (anomaly)
        }),
      ];

      // Should still count based on due_by, not created_at
      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        SESSION_DATE
      );
      expect(count).toBe(1);
    });

    /**
     * Test: Midnight boundary is handled correctly.
     *
     * Purpose: Verify correct behavior at day boundaries. Midnight is a
     * common edge case where off-by-one errors can occur.
     *
     * Strategy: Set session at midnight, create actions 1 minute before,
     * at, and 1 minute after. Verify correct filtering.
     */
    it("should handle midnight boundary correctly", () => {
      const sessionAtMidnight = DateTime.fromISO("2026-01-15T00:00:00.000Z");

      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: sessionAtMidnight.minus({ minutes: 1 }), // 11:59 PM previous day
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: sessionAtMidnight, // Exactly midnight
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: sessionAtMidnight.plus({ minutes: 1 }), // 12:01 AM
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        sessionAtMidnight
      );
      expect(count).toBe(2); // before-midnight and at-midnight
    });

    /**
     * Test: UTC timezone handling is consistent.
     *
     * Purpose: Verify that all date comparisons use consistent timezone
     * handling. All dates should be in UTC to avoid timezone-related bugs.
     *
     * Strategy: Use explicit UTC timestamps for session and actions,
     * verify minute-level precision works correctly.
     */
    it("should handle timezone edge cases with UTC dates", () => {
      // Session at 5 PM UTC (which is 12 PM EST, 9 AM PST)
      const sessionUTC = DateTime.fromISO("2026-01-15T17:00:00.000Z");

      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: DateTime.fromISO("2026-01-15T16:59:00.000Z"), // 1 minute before
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: DateTime.fromISO("2026-01-15T17:00:00.000Z"), // Exactly at
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: DateTime.fromISO("2026-01-15T17:01:00.000Z"), // 1 minute after
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        sessionUTC
      );
      expect(count).toBe(2); // first two actions
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
     * Test: Typical coaching session preparation scenario.
     *
     * Purpose: Verify correct counting in a realistic scenario where a coach
     * has a mix of overdue, due-today, and future actions.
     *
     * Strategy: Simulate a coach with:
     * - 2 overdue actions (from last week)
     * - 1 action due this morning (before 2 PM session)
     * - 1 action due tomorrow
     * - 1 action due next week
     * Expected count: 3 (the overdue ones + this morning)
     */
    it("should correctly count for a typical coaching scenario", () => {
      const sessionToday = REFERENCE_DATE;

      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: sessionToday.minus({ days: 7 }),
          createdAt: sessionToday.minus({ days: 14 }),
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: sessionToday.minus({ days: 3 }),
          createdAt: sessionToday.minus({ days: 10 }),
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: sessionToday.minus({ hours: 5 }), // 9 AM same day
          createdAt: sessionToday.minus({ days: 2 }),
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: sessionToday.plus({ days: 1 }),
          createdAt: sessionToday.minus({ days: 1 }),
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: sessionToday.plus({ days: 7 }),
          createdAt: sessionToday,
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        sessionToday
      );
      expect(count).toBe(3); // first 3 actions (overdue + this morning)
    });

    /**
     * Test: Coach with multiple coachees sees correct counts per session.
     *
     * Purpose: Verify isolation between relationships when a coach has
     * multiple coachees. Each session card should show only relevant actions.
     *
     * Strategy: Create actions for two different coaching relationships,
     * then verify each relationship's count is calculated independently.
     */
    it("should correctly count when user has multiple coaching relationships", () => {
      const sessionToday = REFERENCE_DATE;
      const COACHEE_A_REL = TEST_RELATIONSHIP_IDS.PRIMARY;
      const COACHEE_B_REL = TEST_RELATIONSHIP_IDS.SECONDARY;

      const actions = [
        // Coachee A actions
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: COACHEE_A_REL,
          dueBy: sessionToday.minus({ days: 1 }),
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: COACHEE_A_REL,
          dueBy: sessionToday,
        }),
        // Coachee B actions
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: COACHEE_B_REL,
          dueBy: sessionToday.minus({ days: 1 }),
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: COACHEE_B_REL,
          dueBy: sessionToday.plus({ days: 1 }),
        }),
      ];

      // Session with Coachee A should show 2 actions due
      const countForA = countActionsDueBySession(
        actions,
        COACHEE_A_REL,
        sessionToday
      );
      expect(countForA).toBe(2);

      // Session with Coachee B should show 1 action due
      const countForB = countActionsDueBySession(
        actions,
        COACHEE_B_REL,
        sessionToday
      );
      expect(countForB).toBe(1);
    });

    /**
     * Test: No actions due for a new coaching relationship.
     *
     * Purpose: Verify correct behavior for a brand new coaching relationship
     * where no actions have been created yet.
     *
     * Strategy: Create actions for other relationships only, verify the
     * new relationship shows 0 actions due.
     */
    it("should return 0 for a new relationship with no actions", () => {
      const sessionToday = REFERENCE_DATE;
      const NEW_RELATIONSHIP_ID = TEST_RELATIONSHIP_IDS.TERTIARY;

      const actions = [
        // Only actions for other relationships
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: TEST_RELATIONSHIP_IDS.PRIMARY,
          dueBy: sessionToday.minus({ days: 1 }),
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: TEST_RELATIONSHIP_IDS.SECONDARY,
          dueBy: sessionToday.minus({ days: 1 }),
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        NEW_RELATIONSHIP_ID,
        sessionToday
      );
      expect(count).toBe(0);
    });

    /**
     * Test: All actions are in the future (nothing due yet).
     *
     * Purpose: Verify correct behavior when a user is ahead of schedule
     * and all their actions are due after the upcoming session.
     *
     * Strategy: Create multiple actions all due after the session date,
     * verify count is 0.
     */
    it("should return 0 when all actions are due after the session", () => {
      const sessionToday = REFERENCE_DATE;

      const actions = [
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: sessionToday.plus({ hours: 1 }),
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: sessionToday.plus({ days: 1 }),
        }),
        createMockAssignedAction({
          id: generateTestUUID(),
          relationshipId: SESSION_RELATIONSHIP_ID,
          dueBy: sessionToday.plus({ weeks: 2 }),
        }),
      ];

      const count = countActionsDueBySession(
        actions,
        SESSION_RELATIONSHIP_ID,
        sessionToday
      );
      expect(count).toBe(0);
    });
  });
});
