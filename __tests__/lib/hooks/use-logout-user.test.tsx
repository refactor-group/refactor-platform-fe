import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  deleteUserSession: vi.fn().mockResolvedValue(undefined),
  resetCoachingRelationshipState: vi.fn(),
  resetCoachingSessionsCardFilters: vi.fn(),
  resetOrganizationState: vi.fn(),
  clearCache: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/lib/api/user-sessions", () => ({
  useUserSessionMutation: () => ({ delete: mocks.deleteUserSession }),
}));

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ logout: mocks.logout, userSession: { id: "user-1" } }),
}));

vi.mock("@/lib/providers/coaching-relationship-state-store-provider", () => ({
  useCoachingRelationshipStateStore: (selector: (s: unknown) => unknown) =>
    selector({
      resetCoachingRelationshipState: mocks.resetCoachingRelationshipState,
    }),
}));

vi.mock("@/lib/providers/coaching-sessions-card-filter-store-provider", () => ({
  useCoachingSessionsCardFilterStore: (selector: (s: unknown) => unknown) =>
    selector({
      resetCoachingSessionsCardFilters: mocks.resetCoachingSessionsCardFilters,
    }),
}));

vi.mock("@/lib/providers/organization-state-store-provider", () => ({
  useOrganizationStateStore: (selector: (s: unknown) => unknown) =>
    selector({ resetOrganizationState: mocks.resetOrganizationState }),
}));

vi.mock("@/lib/api/entity-api", () => ({
  EntityApi: { useClearCache: () => mocks.clearCache },
}));

import { useLogoutUser } from "@/lib/hooks/use-logout-user";

describe("useLogoutUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteUserSession.mockResolvedValue(undefined);
  });

  // The organization selection is persisted to localStorage, so leaving it
  // behind hands the next user to sign in on this browser an organization they
  // may not belong to.
  it("clears the persisted organization selection", async () => {
    const { result } = renderHook(() => useLogoutUser());

    await result.current();

    expect(mocks.resetOrganizationState).toHaveBeenCalledTimes(1);
  });

  it("clears the organization selection even when the backend logout fails", async () => {
    mocks.deleteUserSession.mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useLogoutUser());

    await result.current();

    expect(mocks.resetOrganizationState).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/");
  });

  it("resets the other client-side stores alongside it", async () => {
    const { result } = renderHook(() => useLogoutUser());

    await result.current();

    expect(mocks.logout).toHaveBeenCalled();
    expect(mocks.clearCache).toHaveBeenCalledTimes(1);
    expect(mocks.resetCoachingRelationshipState).toHaveBeenCalledTimes(1);
    expect(mocks.resetCoachingSessionsCardFilters).toHaveBeenCalledTimes(1);
  });
});
