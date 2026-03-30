import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { Some, None } from "@/types/option";
import { createMockAction, createMockGoal } from "../../test-utils";
import { useLinkedGoalDisplay } from "@/lib/hooks/use-linked-goal-display";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseGoal = vi.fn();
const mockUseGoalsBySession = vi.fn();

vi.mock("@/lib/api/goals", () => ({
  useGoal: (...args: unknown[]) => mockUseGoal(...args),
  useGoalsBySession: (...args: unknown[]) => mockUseGoalsBySession(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GOAL_A = createMockGoal({ id: "goal-a", title: "Improve communication" });
const GOAL_B = createMockGoal({ id: "goal-b", title: "Build leadership" });

function defaultGoalReturn() {
  return { goal: { id: "", title: "" }, isLoading: false, isError: undefined, refresh: vi.fn() };
}

function loadedGoalReturn(id: string, title: string) {
  return { goal: { id, title }, isLoading: false, isError: undefined, refresh: vi.fn() };
}

function defaultSessionGoalsReturn(goals = []) {
  return { goals, isLoading: false, isError: undefined, refresh: vi.fn() };
}

beforeEach(() => {
  mockUseGoal.mockReturnValue(defaultGoalReturn());
  mockUseGoalsBySession.mockReturnValue(defaultSessionGoalsReturn());
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useLinkedGoalDisplay", () => {
  describe("linkedGoalId", () => {
    it("extracts the goal ID from Some", () => {
      const action = createMockAction({ goal_id: Some("goal-a") });
      const { result } = renderHook(() => useLinkedGoalDisplay(action, [GOAL_A]));

      expect(result.current.linkedGoalId).toBe("goal-a");
    });

    it("returns undefined when goal_id is None", () => {
      const action = createMockAction({ goal_id: None });
      const { result } = renderHook(() => useLinkedGoalDisplay(action, [GOAL_A]));

      expect(result.current.linkedGoalId).toBeUndefined();
    });
  });

  describe("linkedGoalTitle — from goals prop", () => {
    it("resolves title from the goals array when goal is present", () => {
      const action = createMockAction({ goal_id: Some("goal-a") });
      const { result } = renderHook(() => useLinkedGoalDisplay(action, [GOAL_A, GOAL_B]));

      expect(result.current.linkedGoalTitle).toBe("Improve communication");
    });

    it("does NOT call useGoal when goal is found in the array", () => {
      const action = createMockAction({ goal_id: Some("goal-a") });
      renderHook(() => useLinkedGoalDisplay(action, [GOAL_A]));

      // useGoal should be called with "" (skip fetch) because the goal was found in the array
      expect(mockUseGoal).toHaveBeenCalledWith("");
    });

    it("returns undefined title when goal_id is None", () => {
      const action = createMockAction({ goal_id: None });
      const { result } = renderHook(() => useLinkedGoalDisplay(action, [GOAL_A]));

      expect(result.current.linkedGoalTitle).toBeUndefined();
    });
  });

  describe("linkedGoalTitle — lazy fetch fallback", () => {
    it("fetches goal by ID when goals prop does not contain the linked goal", () => {
      mockUseGoal.mockReturnValue(loadedGoalReturn("goal-a", "Improve communication"));

      const action = createMockAction({ goal_id: Some("goal-a") });
      // Pass goals array that does NOT contain goal-a
      const { result } = renderHook(() => useLinkedGoalDisplay(action, [GOAL_B]));

      // Should have called useGoal with the actual ID since it wasn't in the array
      expect(mockUseGoal).toHaveBeenCalledWith("goal-a");
      expect(result.current.linkedGoalTitle).toBe("Improve communication");
    });

    it("fetches goal by ID when no goals prop is provided", () => {
      mockUseGoal.mockReturnValue(loadedGoalReturn("goal-a", "Improve communication"));

      const action = createMockAction({ goal_id: Some("goal-a") });
      const { result } = renderHook(() => useLinkedGoalDisplay(action));

      expect(mockUseGoal).toHaveBeenCalledWith("goal-a");
      expect(result.current.linkedGoalTitle).toBe("Improve communication");
    });

    it("returns undefined title when useGoal returns default (empty id)", () => {
      // useGoal returns default goal with id: "" (still loading or no data)
      mockUseGoal.mockReturnValue(defaultGoalReturn());

      const action = createMockAction({ goal_id: Some("goal-a") });
      const { result } = renderHook(() => useLinkedGoalDisplay(action));

      expect(result.current.linkedGoalTitle).toBeUndefined();
    });
  });

  describe("resolvedGoals — for the goal picker", () => {
    it("returns the goals prop when provided", () => {
      const action = createMockAction({ goal_id: None });
      const goals = [GOAL_A, GOAL_B];
      const { result } = renderHook(() => useLinkedGoalDisplay(action, goals));

      expect(result.current.resolvedGoals).toBe(goals);
    });

    it("skips session goals fetch when goals prop is provided", () => {
      const action = createMockAction({ goal_id: None });
      renderHook(() => useLinkedGoalDisplay(action, [GOAL_A]));

      // Should pass null to skip the SWR fetch
      expect(mockUseGoalsBySession).toHaveBeenCalledWith(null);
    });

    it("lazy-fetches session goals when goals prop is absent", () => {
      mockUseGoalsBySession.mockReturnValue(defaultSessionGoalsReturn([GOAL_A, GOAL_B]));

      const action = createMockAction({
        goal_id: None,
        coaching_session_id: "session-42",
      });
      const { result } = renderHook(() => useLinkedGoalDisplay(action));

      expect(mockUseGoalsBySession).toHaveBeenCalledWith("session-42");
      expect(result.current.resolvedGoals).toEqual([GOAL_A, GOAL_B]);
    });

    it("returns undefined when goals prop is absent and session has no goals", () => {
      mockUseGoalsBySession.mockReturnValue(defaultSessionGoalsReturn([]));

      const action = createMockAction({ goal_id: None });
      const { result } = renderHook(() => useLinkedGoalDisplay(action));

      expect(result.current.resolvedGoals).toBeUndefined();
    });
  });
});
