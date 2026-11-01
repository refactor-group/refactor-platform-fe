import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import { None, Some } from "@/types/option";
import { AssignmentFilter, CoachViewMode, type AssignedActionWithContext } from "@/types/assigned-actions";
import { useOpenActionCount } from "@/lib/hooks/use-open-action-count";
import { countVisibleActions, DEFAULT_ACTIONS_VIEW } from "@/lib/hooks/use-actions-view";
import { createMockAction } from "../../test-utils";

const h = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("@/lib/hooks/use-all-actions-with-context", () => ({
  useAllActionsWithContext: (...args: unknown[]) => h.fetch(...args),
}));

const today = DateTime.now();
const card = (status: ItemStatus, dueDaysFromNow?: number): AssignedActionWithContext =>
  ({
    action: createMockAction({
      id: `${status}-${dueDaysFromNow}`,
      status,
      due_by: dueDaysFromNow === undefined ? None : Some(today.plus({ days: dueDaysFromNow })),
    }),
  }) as AssignedActionWithContext;

// What the Actions page's default view shows: open statuses, due in the last
// 30 days or later, or undated.
const ACTIONS = [
  card(ItemStatus.NotStarted, 3),
  card(ItemStatus.InProgress, -10),
  card(ItemStatus.OnHold),
  card(ItemStatus.InProgress, -45), // hidden by the page's 30 day range
  card(ItemStatus.Completed, 1),
  card(ItemStatus.WontDo, 1),
];

describe("countVisibleActions", () => {
  it("counts the cards in the visible status columns", () => {
    expect(countVisibleActions(ACTIONS, DEFAULT_ACTIONS_VIEW.statusVisibility)).toBe(4);
    expect(countVisibleActions([], DEFAULT_ACTIONS_VIEW.statusVisibility)).toBe(0);
  });
});

describe("useOpenActionCount", () => {
  beforeEach(() => {
    h.fetch.mockReset().mockReturnValue({
      actionsWithContext: ACTIONS,
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    });
  });

  it("counts what the Actions page shows by default", () => {
    const { result } = renderHook(() => useOpenActionCount());
    expect(result.current).toBe(3);
  });

  it("reads the page's default view from the cache without revalidating", () => {
    renderHook(() => useOpenActionCount());
    expect(h.fetch).toHaveBeenCalledWith(
      CoachViewMode.MyActions,
      undefined,
      AssignmentFilter.Assigned,
      {
        revalidateOnMount: undefined,
        revalidateIfStale: false,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
      }
    );
  });

  it.each([
    ["while loading", { isLoading: true, isError: false }],
    ["on error", { isLoading: false, isError: true }],
  ])("is 0 %s", (_, state) => {
    h.fetch.mockReturnValue({ actionsWithContext: ACTIONS, refresh: vi.fn(), ...state });
    const { result } = renderHook(() => useOpenActionCount());
    expect(result.current).toBe(0);
  });
});
