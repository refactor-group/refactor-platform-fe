import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import { useOptimisticStatus } from "@/components/ui/actions/use-optimistic-status";

const now = DateTime.now();

function makeCtx(
  id: string,
  status: ItemStatus
): AssignedActionWithContext {
  return {
    action: {
      id,
      coaching_session_id: "session-1",
      body: `Action ${id}`,
      user_id: "user-1",
      status,
      status_changed_at: now,
      due_by: now.plus({ days: 7 }),
      created_at: now,
      updated_at: now,
      assignee_ids: [],
    },
    relationship: {
      id: "rel-1",
      coach_id: "coach-1",
      coachee_id: "coachee-1",
      organization_id: "org-1",
      created_at: now,
      updated_at: now,
      coach_first_name: "Alice",
      coach_last_name: "",
      coachee_first_name: "Bob",
      coachee_last_name: "",
    },
    goal: { goalId: "goal-1", title: "Goal" },
    sourceSession: { coachingSessionId: "session-1", sessionDate: now },
    nextSession: null,
    isOverdue: false,
  };
}

describe("useOptimisticStatus", () => {
  it("returns the original array reference when no overrides are set", () => {
    const actions = [makeCtx("a1", ItemStatus.NotStarted)];
    const { result } = renderHook(() => useOptimisticStatus(actions));

    expect(result.current.actionsWithOverrides).toBe(actions);
  });

  it("applies an override to move a card to a new status", () => {
    const actions = [
      makeCtx("a1", ItemStatus.NotStarted),
      makeCtx("a2", ItemStatus.InProgress),
    ];
    const { result } = renderHook(() => useOptimisticStatus(actions));

    act(() => {
      result.current.applyOverride("a1", ItemStatus.Completed);
    });

    const overridden = result.current.actionsWithOverrides;
    expect(overridden[0].action.status).toBe(ItemStatus.Completed);
    // Other actions are unaffected
    expect(overridden[1].action.status).toBe(ItemStatus.InProgress);
  });

  it("rolls back an override, restoring the original status", () => {
    const actions = [makeCtx("a1", ItemStatus.NotStarted)];
    const { result } = renderHook(() => useOptimisticStatus(actions));

    act(() => {
      result.current.applyOverride("a1", ItemStatus.Completed);
    });
    expect(result.current.actionsWithOverrides[0].action.status).toBe(
      ItemStatus.Completed
    );

    act(() => {
      result.current.rollbackOverride("a1");
    });
    expect(result.current.actionsWithOverrides[0].action.status).toBe(
      ItemStatus.NotStarted
    );
  });

  it("clears override automatically when real data catches up", () => {
    const initial = [makeCtx("a1", ItemStatus.NotStarted)];
    const { result, rerender } = renderHook(
      ({ actions }) => useOptimisticStatus(actions),
      { initialProps: { actions: initial } }
    );

    act(() => {
      result.current.applyOverride("a1", ItemStatus.Completed);
    });
    expect(result.current.actionsWithOverrides[0].action.status).toBe(
      ItemStatus.Completed
    );

    // Simulate SWR revalidation delivering the updated status
    const updated = [makeCtx("a1", ItemStatus.Completed)];
    rerender({ actions: updated });

    // Override is cleared — returns the real array reference
    expect(result.current.actionsWithOverrides).toBe(updated);
  });

  it("handles multiple simultaneous overrides", () => {
    const actions = [
      makeCtx("a1", ItemStatus.NotStarted),
      makeCtx("a2", ItemStatus.NotStarted),
    ];
    const { result } = renderHook(() => useOptimisticStatus(actions));

    act(() => {
      result.current.applyOverride("a1", ItemStatus.InProgress);
      result.current.applyOverride("a2", ItemStatus.Completed);
    });

    const overridden = result.current.actionsWithOverrides;
    expect(overridden[0].action.status).toBe(ItemStatus.InProgress);
    expect(overridden[1].action.status).toBe(ItemStatus.Completed);
  });

  it("rolling back one override does not affect another", () => {
    const actions = [
      makeCtx("a1", ItemStatus.NotStarted),
      makeCtx("a2", ItemStatus.NotStarted),
    ];
    const { result } = renderHook(() => useOptimisticStatus(actions));

    act(() => {
      result.current.applyOverride("a1", ItemStatus.InProgress);
      result.current.applyOverride("a2", ItemStatus.Completed);
    });

    act(() => {
      result.current.rollbackOverride("a1");
    });

    const overridden = result.current.actionsWithOverrides;
    expect(overridden[0].action.status).toBe(ItemStatus.NotStarted);
    expect(overridden[1].action.status).toBe(ItemStatus.Completed);
  });

  it("simulates full optimistic cycle: apply → API failure → rollback to original column", async () => {
    const actions = [
      makeCtx("a1", ItemStatus.NotStarted),
      makeCtx("a2", ItemStatus.InProgress),
    ];
    const { result } = renderHook(() => useOptimisticStatus(actions));

    // 1. Optimistic: card moves to Completed immediately
    act(() => {
      result.current.applyOverride("a1", ItemStatus.Completed);
    });
    expect(result.current.actionsWithOverrides[0].action.status).toBe(
      ItemStatus.Completed
    );

    // 2. Simulate a failing API call, then roll back in the catch
    const failingApiCall = Promise.reject(new Error("network error"));
    await act(async () => {
      try {
        await failingApiCall;
      } catch {
        result.current.rollbackOverride("a1");
      }
    });

    // 3. Card is back in its original column
    expect(result.current.actionsWithOverrides[0].action.status).toBe(
      ItemStatus.NotStarted
    );
    // Other cards unaffected throughout
    expect(result.current.actionsWithOverrides[1].action.status).toBe(
      ItemStatus.InProgress
    );
  });
});
