import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { DateTime } from "ts-luxon";
import { Some, None } from "@/types/option";
import { ItemStatus } from "@/types/general";
import type { Action } from "@/types/action";
import { usePanelActions } from "@/lib/hooks/use-panel-actions";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreate = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockGlobalMutate = vi.fn();
const mockRefreshSession = vi.fn();
const mockRefreshAll = vi.fn();

vi.mock("@/lib/api/actions", () => ({
  useActionMutation: () => ({
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("swr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("swr")>();
  return {
    ...actual,
    useSWRConfig: () => ({ mutate: mockGlobalMutate }),
  };
});

// Session actions returned by the first useUserActionsList call
let mockSessionActions: Action[] = [];
// Relationship actions returned by the second call
let mockRelationshipActions: Action[] = [];

vi.mock("@/lib/api/user-actions", () => ({
  useUserActionsList: (_userId: string, params: Record<string, unknown>) => {
    // Distinguish the two calls by whether coaching_session_id is present
    const isSessionScoped = "coaching_session_id" in params;
    return {
      actions: isSessionScoped ? mockSessionActions : mockRelationshipActions,
      isLoading: false,
      isError: undefined,
      refresh: isSessionScoped ? mockRefreshSession : mockRefreshAll,
    };
  },
}));

vi.mock("@/lib/api/coaching-sessions", () => ({
  useCoachingSessionList: () => ({
    coachingSessions: [],
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = DateTime.fromISO("2026-03-30T12:00:00Z");

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: "action-1",
    coaching_session_id: "session-1",
    goal_id: None,
    body: "Test action",
    user_id: "user-1",
    status: ItemStatus.NotStarted,
    status_changed_at: now,
    due_by: Some(now.plus({ days: 7 })),
    created_at: now,
    updated_at: now,
    assignee_ids: [],
    ...overrides,
  };
}

const PARAMS = {
  userId: "user-1",
  coachingSessionId: "session-1",
  coachingRelationshipId: "rel-1",
  sessionDate: "2026-03-30T12:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionActions = [];
  mockRelationshipActions = [];
});

// ---------------------------------------------------------------------------
// handleGoalChange
// ---------------------------------------------------------------------------

describe("handleGoalChange", () => {
  it("calls update with goal_id: Some when linking a goal", async () => {
    const action = makeAction({ id: "action-1", goal_id: None });
    mockSessionActions = [action];

    const { result } = renderHook(() => usePanelActions(PARAMS));

    await act(async () => {
      await result.current.handleGoalChange("action-1", "goal-abc");
    });

    expect(mockUpdate).toHaveBeenCalledOnce();
    const [id, updated] = mockUpdate.mock.calls[0];
    expect(id).toBe("action-1");
    expect(updated.goal_id).toEqual(Some("goal-abc"));
  });

  it("calls update with goal_id: None when unlinking a goal", async () => {
    const action = makeAction({ id: "action-1", goal_id: Some("goal-abc") });
    mockSessionActions = [action];

    const { result } = renderHook(() => usePanelActions(PARAMS));

    await act(async () => {
      await result.current.handleGoalChange("action-1", undefined);
    });

    expect(mockUpdate).toHaveBeenCalledOnce();
    const [, updated] = mockUpdate.mock.calls[0];
    expect(updated.goal_id).toEqual(None);
  });

  it("revalidates goal progress cache after linking", async () => {
    mockSessionActions = [makeAction()];
    const { result } = renderHook(() => usePanelActions(PARAMS));

    await act(async () => {
      await result.current.handleGoalChange("action-1", "goal-abc");
    });

    expect(mockGlobalMutate).toHaveBeenCalledOnce();
  });

  it("revalidates goal progress cache after unlinking", async () => {
    mockSessionActions = [makeAction({ goal_id: Some("goal-abc") })];
    const { result } = renderHook(() => usePanelActions(PARAMS));

    await act(async () => {
      await result.current.handleGoalChange("action-1", undefined);
    });

    expect(mockGlobalMutate).toHaveBeenCalledOnce();
  });

  it("does nothing when action ID is not found", async () => {
    mockSessionActions = [];
    const { result } = renderHook(() => usePanelActions(PARAMS));

    await act(async () => {
      await result.current.handleGoalChange("nonexistent", "goal-abc");
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockGlobalMutate).not.toHaveBeenCalled();
  });

  it("finds action in relationship actions when not in session actions", async () => {
    const action = makeAction({ id: "action-rel", coaching_session_id: "other-session" });
    mockRelationshipActions = [action];

    const { result } = renderHook(() => usePanelActions(PARAMS));

    await act(async () => {
      await result.current.handleGoalChange("action-rel", "goal-abc");
    });

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdate.mock.calls[0][0]).toBe("action-rel");
  });
});

// ---------------------------------------------------------------------------
// handleCreate — goal linking
// ---------------------------------------------------------------------------

describe("handleCreate — goal linking", () => {
  it("creates action with goal_id: Some when goalId is provided", async () => {
    const { result } = renderHook(() => usePanelActions(PARAMS));

    await act(async () => {
      await result.current.handleCreate("New action", ["user-1"], "goal-abc");
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const created = mockCreate.mock.calls[0][0];
    expect(created.goal_id).toEqual(Some("goal-abc"));
    expect(created.body).toBe("New action");
    expect(created.coaching_session_id).toBe("session-1");
  });

  it("creates action with goal_id: None when goalId is omitted", async () => {
    const { result } = renderHook(() => usePanelActions(PARAMS));

    await act(async () => {
      await result.current.handleCreate("New action");
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const created = mockCreate.mock.calls[0][0];
    expect(created.goal_id).toEqual(None);
  });

  it("revalidates goal progress when goalId is provided", async () => {
    const { result } = renderHook(() => usePanelActions(PARAMS));

    await act(async () => {
      await result.current.handleCreate("New action", [], "goal-abc");
    });

    expect(mockGlobalMutate).toHaveBeenCalledOnce();
  });

  it("does NOT revalidate goal progress when goalId is omitted", async () => {
    const { result } = renderHook(() => usePanelActions(PARAMS));

    await act(async () => {
      await result.current.handleCreate("New action");
    });

    expect(mockGlobalMutate).not.toHaveBeenCalled();
  });

  // ── Due date plumbing ──────────────────────────────────────────────
  // Regression: previously handleCreate hard-coded due_by to now()+7 days,
  // discarding any value picked in the UI when adding a new action.

  it("uses the provided dueBy when creating an action", async () => {
    const { result } = renderHook(() => usePanelActions(PARAMS));
    const picked = DateTime.now().plus({ days: 60 }).startOf("day");

    await act(async () => {
      await result.current.handleCreate("New action", [], undefined, picked);
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const created = mockCreate.mock.calls[0][0] as Action;
    expect(created.due_by.some).toBe(true);
    expect(created.due_by.some && created.due_by.val.toISO()).toBe(picked.toISO());
  });

  it("falls back to now()+7 days when dueBy is omitted", async () => {
    const { result } = renderHook(() => usePanelActions(PARAMS));
    const before = DateTime.now();

    await act(async () => {
      await result.current.handleCreate("New action");
    });

    const after = DateTime.now();
    const created = mockCreate.mock.calls[0][0] as Action;
    expect(created.due_by.some).toBe(true);
    if (!created.due_by.some) throw new Error("expected a due date");
    // due_by should fall in [before+7d, after+7d] (a few-ms window).
    expect(created.due_by.val.toMillis()).toBeGreaterThanOrEqual(
      before.plus({ days: 7 }).toMillis()
    );
    expect(created.due_by.val.toMillis()).toBeLessThanOrEqual(
      after.plus({ days: 7 }).toMillis()
    );
  });
});

// ---------------------------------------------------------------------------
// handleStatusChange — conditional goal progress revalidation
// ---------------------------------------------------------------------------

describe("handleStatusChange — goal progress revalidation", () => {
  it("revalidates goal progress when action has a goal link", async () => {
    const action = makeAction({ goal_id: Some("goal-abc") });
    mockSessionActions = [action];

    const { result } = renderHook(() => usePanelActions(PARAMS));

    await act(async () => {
      await result.current.handleStatusChange("action-1", ItemStatus.Completed);
    });

    expect(mockGlobalMutate).toHaveBeenCalled();
  });

  it("does NOT revalidate goal progress when action has no goal link", async () => {
    const action = makeAction({ goal_id: None });
    mockSessionActions = [action];

    const { result } = renderHook(() => usePanelActions(PARAMS));

    await act(async () => {
      await result.current.handleStatusChange("action-1", ItemStatus.Completed);
    });

    expect(mockGlobalMutate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// revalidateGoalProgress — SWR key filter
// ---------------------------------------------------------------------------

describe("revalidateGoalProgress key filter", () => {
  it("matches goal progress URLs", async () => {
    mockSessionActions = [makeAction()];
    const { result } = renderHook(() => usePanelActions(PARAMS));

    await act(async () => {
      await result.current.handleGoalChange("action-1", "goal-abc");
    });

    // Extract the predicate function passed to globalMutate
    const predicate = mockGlobalMutate.mock.calls[0][0] as (key: unknown) => boolean;

    // Should match goal progress URLs
    expect(predicate("http://localhost/api/goals/goal-123/progress")).toBe(true);
    expect(predicate("http://localhost/api/goals/abc-def/progress")).toBe(true);

    // Should NOT match non-goal progress URLs
    expect(predicate("http://localhost/api/users/user-1/progress")).toBe(false);
    expect(predicate("http://localhost/api/goals/goal-123/actions")).toBe(false);
    expect(predicate("http://localhost/api/progress")).toBe(false);
    expect(predicate("/progress")).toBe(false);
    expect(predicate(42)).toBe(false);
    expect(predicate(null)).toBe(false);
  });
});
