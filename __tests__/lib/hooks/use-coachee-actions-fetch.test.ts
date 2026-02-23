import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import { UserActionsScope, UserActionsAssigneeFilter } from "@/types/assigned-actions";
import type { Action } from "@/types/action";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockList = vi.fn();

vi.mock("@/lib/api/user-actions", () => ({
  UserActionsApi: {
    list: (...args: unknown[]) => mockList(...args),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { useCoacheeActionsFetch } = await import(
  "@/lib/hooks/use-coachee-actions-fetch"
);

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const now = DateTime.now();

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: "action-1",
    coaching_session_id: "session-1",
    body: "Test action",
    user_id: "user-1",
    status: ItemStatus.NotStarted,
    status_changed_at: now,
    due_by: now.plus({ days: 7 }),
    created_at: now,
    updated_at: now,
    assignee_ids: ["user-1"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCoacheeActionsFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue([]);
  });

  it("returns empty actions when enabled is false", async () => {
    const { result } = renderHook(() =>
      useCoacheeActionsFetch(["coachee-1"], false)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.actions).toEqual([]);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("returns empty actions for empty coacheeIds", async () => {
    const { result } = renderHook(() =>
      useCoacheeActionsFetch([], true)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.actions).toEqual([]);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("fetches actions for each coachee in parallel and returns flattened result", async () => {
    const action1 = makeAction({ id: "a1", user_id: "coachee-1" });
    const action2 = makeAction({ id: "a2", user_id: "coachee-2" });

    mockList
      .mockResolvedValueOnce([action1])
      .mockResolvedValueOnce([action2]);

    const { result } = renderHook(() =>
      useCoacheeActionsFetch(["coachee-1", "coachee-2"], true)
    );

    await waitFor(() => {
      expect(result.current.actions).toHaveLength(2);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.actions.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it("passes scope, coaching_relationship_id, and assignee_filter to each API call", async () => {
    mockList.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useCoacheeActionsFetch(
        ["coachee-1"],
        true,
        "rel-1",
        UserActionsScope.Sessions,
        UserActionsAssigneeFilter.Unassigned
      )
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockList).toHaveBeenCalledWith("coachee-1", {
      scope: UserActionsScope.Sessions,
      coaching_relationship_id: "rel-1",
      assignee_filter: UserActionsAssigneeFilter.Unassigned,
    });
  });

  it("sets isError to true on fetch failure", async () => {
    mockList.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useCoacheeActionsFetch(["coachee-1"], true)
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.actions).toEqual([]);
  });

  it("refresh() triggers a re-fetch", async () => {
    const action1 = makeAction({ id: "a1" });
    const action2 = makeAction({ id: "a2" });

    mockList.mockResolvedValueOnce([action1]);

    const { result } = renderHook(() =>
      useCoacheeActionsFetch(["coachee-1"], true)
    );

    await waitFor(() => {
      expect(result.current.actions).toHaveLength(1);
    });

    expect(mockList).toHaveBeenCalledTimes(1);

    // Set up the next response and trigger refresh
    mockList.mockResolvedValueOnce([action1, action2]);
    result.current.refresh();

    await waitFor(() => {
      expect(result.current.actions).toHaveLength(2);
    });

    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it("does not re-fetch when coacheeIds array identity changes but content is the same", async () => {
    mockList.mockResolvedValue([makeAction()]);

    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useCoacheeActionsFetch(ids, true),
      { initialProps: { ids: ["coachee-1", "coachee-2"] } }
    );

    // 2 coachees × 1 action each = 2 actions flattened
    await waitFor(() => {
      expect(result.current.actions).toHaveLength(2);
    });

    const callCountAfterFirstFetch = mockList.mock.calls.length;

    // Re-render with a new array reference containing the same IDs
    rerender({ ids: ["coachee-1", "coachee-2"] });

    // Wait a tick to ensure no additional fetch is triggered
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockList.mock.calls.length).toBe(callCountAfterFirstFetch);
  });
});
