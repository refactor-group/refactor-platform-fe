import { describe, it, expect, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import { filterReviewActions } from "@/components/ui/coaching-sessions/actions-panel";

vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: { children: string }) => children,
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneLight: {},
  oneDark: {},
}));
import {
  createMockAction,
  TEST_SESSION_IDS,
  TEST_USER_IDS,
} from "../../../utils/action-test-utils";

// ============================================================================
// Test Constants
// ============================================================================

const CURRENT_SESSION_ID = TEST_SESSION_IDS.SESSION_1;
const OTHER_SESSION_ID = TEST_SESSION_IDS.SESSION_2;
const THIRD_SESSION_ID = TEST_SESSION_IDS.SESSION_3;

/** Current session: Feb 11, 2026 */
const CURRENT_SESSION_DATE = DateTime.fromISO("2026-02-11");
/** Previous session: Feb 3, 2026 */
const PREVIOUS_SESSION_DATE = DateTime.fromISO("2026-02-03");

// ============================================================================
// Helpers
// ============================================================================

/** Shorthand for creating an action from another session with a given due date and status */
function reviewAction(
  id: string,
  dueByISO: string,
  status: ItemStatus = ItemStatus.NotStarted,
  sessionId: string = OTHER_SESSION_ID
) {
  return createMockAction({
    id,
    coachingSessionId: sessionId,
    userId: TEST_USER_IDS.COACH,
    dueBy: DateTime.fromISO(dueByISO),
    status,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("filterReviewActions", () => {
  describe("excludes actions from the current session", () => {
    it("should not include actions belonging to the current session", () => {
      const actions = [
        reviewAction("a1", "2026-02-10", ItemStatus.NotStarted, CURRENT_SESSION_ID),
        reviewAction("a2", "2026-02-10", ItemStatus.NotStarted, OTHER_SESSION_ID),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("a2");
    });
  });

  describe("window-based filtering [previousSession, currentSession]", () => {
    it("should include actions due within the window regardless of status", () => {
      const actions = [
        reviewAction("a1", "2026-02-03", ItemStatus.NotStarted),
        reviewAction("a2", "2026-02-05", ItemStatus.InProgress),
        reviewAction("a3", "2026-02-08", ItemStatus.Completed),
        reviewAction("a4", "2026-02-11", ItemStatus.WontDo),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result).toHaveLength(4);
      const ids = result.map((a) => a.id);
      expect(ids).toContain("a1");
      expect(ids).toContain("a2");
      expect(ids).toContain("a3");
      expect(ids).toContain("a4");
    });

    it("should include actions due on exactly the previous session date", () => {
      const actions = [
        reviewAction("a1", "2026-02-03", ItemStatus.InProgress),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result).toHaveLength(1);
    });

    it("should include actions due on exactly the current session date", () => {
      const actions = [
        reviewAction("a1", "2026-02-11", ItemStatus.Completed),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result).toHaveLength(1);
    });
  });

  describe("actions due after the current session", () => {
    it("should exclude actions due after the current session date", () => {
      const actions = [
        reviewAction("a1", "2026-02-12", ItemStatus.NotStarted),
        reviewAction("a2", "2026-03-01", ItemStatus.InProgress),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result).toHaveLength(0);
    });
  });

  describe("overdue actions (due before the window)", () => {
    it("should include outstanding actions due before the window", () => {
      const actions = [
        reviewAction("a1", "2026-01-15", ItemStatus.NotStarted),
        reviewAction("a2", "2026-02-01", ItemStatus.InProgress),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result).toHaveLength(2);
    });

    it("should exclude completed actions due before the window", () => {
      const actions = [
        reviewAction("a1", "2026-01-15", ItemStatus.Completed),
        reviewAction("a2", "2026-02-01", ItemStatus.WontDo),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result).toHaveLength(0);
    });

    it("should include outstanding but exclude completed actions before the window", () => {
      const actions = [
        reviewAction("outstanding", "2026-01-20", ItemStatus.InProgress),
        reviewAction("completed", "2026-01-20", ItemStatus.Completed),
        reviewAction("not-started", "2026-01-25", ItemStatus.NotStarted),
        reviewAction("wont-do", "2026-01-25", ItemStatus.WontDo),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result).toHaveLength(2);
      const ids = result.map((a) => a.id);
      expect(ids).toContain("outstanding");
      expect(ids).toContain("not-started");
    });
  });

  describe("no previous session", () => {
    it("should include all actions due on or before current session when no previous session exists", () => {
      const actions = [
        reviewAction("a1", "2025-06-01", ItemStatus.Completed),
        reviewAction("a2", "2026-01-01", ItemStatus.InProgress),
        reviewAction("a3", "2026-02-11", ItemStatus.NotStarted),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        null
      );

      // With no previous session, there's no window start — all actions due on or
      // before the current session are included regardless of status.
      expect(result).toHaveLength(3);
    });

    it("should still exclude actions due after the current session", () => {
      const actions = [
        reviewAction("a1", "2026-02-12", ItemStatus.NotStarted),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        null
      );

      expect(result).toHaveLength(0);
    });
  });

  describe("sticky IDs", () => {
    it("should retain actions in the sticky set even if due date moves past the window", () => {
      const stickyIds = new Set(["sticky-action"]);
      const actions = [
        reviewAction("sticky-action", "2026-03-15", ItemStatus.InProgress),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE,
        stickyIds
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("sticky-action");
    });

    it("should not retain sticky actions from the current session", () => {
      const stickyIds = new Set(["sticky-action"]);
      const actions = [
        reviewAction("sticky-action", "2026-03-15", ItemStatus.InProgress, CURRENT_SESSION_ID),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE,
        stickyIds
      );

      // Current session exclusion takes precedence over sticky
      expect(result).toHaveLength(0);
    });

    it("should retain an overdue action in the sticky set after status changes to Completed", () => {
      // This action is due before the previous session date.
      // Without sticky IDs, it would be filtered out once status = Completed.
      const stickyIds = new Set(["overdue-action"]);
      const actions = [
        reviewAction("overdue-action", "2026-01-15", ItemStatus.Completed),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE,
        stickyIds
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("overdue-action");
    });

    it("should retain a sticky action after status changes to WontDo", () => {
      const stickyIds = new Set(["wontdo-action"]);
      const actions = [
        reviewAction("wontdo-action", "2026-01-20", ItemStatus.WontDo),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE,
        stickyIds
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("wontdo-action");
    });
  });

  describe("sorting", () => {
    it("should sort results in reverse chronological order by due_by", () => {
      const actions = [
        reviewAction("earliest", "2026-02-04"),
        reviewAction("latest", "2026-02-10"),
        reviewAction("middle", "2026-02-07"),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result.map((a) => a.id)).toEqual(["latest", "middle", "earliest"]);
    });
  });

  describe("mixed scenarios", () => {
    it("should correctly filter a realistic set of actions", () => {
      const actions = [
        // Current session — should be excluded
        reviewAction("current-1", "2026-02-10", ItemStatus.NotStarted, CURRENT_SESSION_ID),

        // In window — should all be included
        reviewAction("window-completed", "2026-02-05", ItemStatus.Completed),
        reviewAction("window-in-progress", "2026-02-08", ItemStatus.InProgress),
        reviewAction("window-not-started", "2026-02-11", ItemStatus.NotStarted),

        // Before window, outstanding — should be included
        reviewAction("overdue-old", "2026-01-10", ItemStatus.NotStarted),

        // Before window, completed — should be excluded
        reviewAction("done-old", "2026-01-10", ItemStatus.Completed),

        // After window — should be excluded
        reviewAction("future", "2026-02-20", ItemStatus.NotStarted),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result).toHaveLength(4);
      const ids = result.map((a) => a.id);
      expect(ids).toContain("window-completed");
      expect(ids).toContain("window-in-progress");
      expect(ids).toContain("window-not-started");
      expect(ids).toContain("overdue-old");

      expect(ids).not.toContain("current-1");
      expect(ids).not.toContain("done-old");
      expect(ids).not.toContain("future");
    });

    it("should handle actions from multiple other sessions", () => {
      const actions = [
        reviewAction("from-session-2", "2026-02-05", ItemStatus.InProgress, OTHER_SESSION_ID),
        reviewAction("from-session-3", "2026-02-09", ItemStatus.NotStarted, THIRD_SESSION_ID),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result).toHaveLength(2);
    });

    it("should return empty array when there are no actions", () => {
      const result = filterReviewActions(
        [],
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result).toHaveLength(0);
    });

    it("should return empty array when all actions belong to the current session", () => {
      const actions = [
        reviewAction("a1", "2026-02-10", ItemStatus.NotStarted, CURRENT_SESSION_ID),
        reviewAction("a2", "2026-02-08", ItemStatus.InProgress, CURRENT_SESSION_ID),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result).toHaveLength(0);
    });
  });

  describe("boundary: end of current session day", () => {
    it("should include actions due at end of current session day", () => {
      const actions = [
        reviewAction("eod", "2026-02-11T23:59:59"),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result).toHaveLength(1);
    });

    it("should exclude actions due at start of next day", () => {
      const actions = [
        reviewAction("next-day", "2026-02-12T00:00:01"),
      ];

      const result = filterReviewActions(
        actions,
        CURRENT_SESSION_ID,
        CURRENT_SESSION_DATE,
        PREVIOUS_SESSION_DATE
      );

      expect(result).toHaveLength(0);
    });
  });
});
