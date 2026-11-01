import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { ItemStatus } from "@/types/general";
import { UserActionsAssigneeFilter } from "@/types/assigned-actions";
import { countOpenActions, useOpenActionCount } from "@/lib/hooks/use-open-action-count";
import { createMockAction } from "../../test-utils";

const h = vi.hoisted(() => ({
  userId: "user-1",
  currentOrganizationId: "org-1" as string | null,
  fetch: vi.fn(),
}));

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ userId: h.userId }),
}));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: h.currentOrganizationId }),
}));
vi.mock("@/lib/api/relationship-actions", () => ({
  useBatchRelationshipActions: (...args: unknown[]) => h.fetch(...args),
}));

const actionsIn = (...statuses: ItemStatus[]) =>
  statuses.map((status, i) => createMockAction({ id: `action-${i}`, status }));

describe("countOpenActions", () => {
  it("counts only not started, in progress and on hold actions", () => {
    const actions = actionsIn(
      ItemStatus.NotStarted,
      ItemStatus.InProgress,
      ItemStatus.OnHold,
      ItemStatus.Completed,
      ItemStatus.WontDo,
      ItemStatus.InProgress
    );

    expect(countOpenActions(actions)).toBe(4);
  });

  it("is 0 with no actions", () => {
    expect(countOpenActions([])).toBe(0);
  });
});

describe("useOpenActionCount", () => {
  beforeEach(() => {
    h.userId = "user-1";
    h.currentOrganizationId = "org-1";
    h.fetch.mockReset().mockReturnValue({
      actions: actionsIn(ItemStatus.InProgress, ItemStatus.OnHold, ItemStatus.Completed),
      isLoading: false,
      isError: false,
    });
  });

  it("asks for the current user's assigned actions whatever their role", () => {
    const { result } = renderHook(() => useOpenActionCount());

    expect(result.current).toBe(2);
    expect(h.fetch).toHaveBeenCalledWith(
      "org-1",
      { assignee: "user-1", assignee_filter: UserActionsAssigneeFilter.Assigned },
      { revalidateOnFocus: false }
    );
  });

  it("doesn't fetch without a user", () => {
    h.userId = "";
    renderHook(() => useOpenActionCount());

    expect(h.fetch).toHaveBeenCalledWith(null, expect.anything(), expect.anything());
  });

  it("doesn't fetch without an organization", () => {
    h.currentOrganizationId = null;
    renderHook(() => useOpenActionCount());

    expect(h.fetch).toHaveBeenCalledWith(null, expect.anything(), expect.anything());
  });

  it("is 0 while loading", () => {
    h.fetch.mockReturnValue({ actions: [], isLoading: true, isError: false });
    const { result } = renderHook(() => useOpenActionCount());

    expect(result.current).toBe(0);
  });

  it("is 0 on error, even with stale actions", () => {
    h.fetch.mockReturnValue({
      actions: actionsIn(ItemStatus.InProgress),
      isLoading: false,
      isError: true,
    });
    const { result } = renderHook(() => useOpenActionCount());

    expect(result.current).toBe(0);
  });
});
