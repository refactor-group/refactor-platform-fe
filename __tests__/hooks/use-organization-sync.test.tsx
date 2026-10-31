import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  ORGANIZATIONS: [
    { id: "org-1", name: "Acme Corp", slug: "acme-corp" },
    { id: "org-2", name: "Beta Inc", slug: "beta-inc" },
  ],
  listState: {
    organizations: [] as unknown[],
    isLoading: false,
    isError: false as unknown,
  },
  currentOrganizationId: "",
  setCurrentOrganizationId: vi.fn(),
  lastOrganizationIdByUser: {} as Record<string, string>,
  rememberOrganizationForUser: vi.fn(),
  forgetOrganizationForUser: vi.fn(),
}));

vi.mock("@/lib/api/organizations", () => ({
  useOrganizationList: () => h.listState,
  useOrganization: () => ({
    organization: null,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => ({ relationships: [] }),
}));

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({
    currentOrganizationId: h.currentOrganizationId,
    currentOrganization: null,
    setCurrentOrganizationId: h.setCurrentOrganizationId,
    lastOrganizationIdByUser: h.lastOrganizationIdByUser,
    rememberOrganizationForUser: h.rememberOrganizationForUser,
    forgetOrganizationForUser: h.forgetOrganizationForUser,
  }),
}));

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ userId: "user-1", isLoggedIn: true, setIsACoach: vi.fn() }),
}));

import { useOrganizationSync } from "@/lib/hooks/use-organization-sync";

function resetMocks() {
  vi.clearAllMocks();
  h.listState = { organizations: h.ORGANIZATIONS, isLoading: false, isError: false };
  h.currentOrganizationId = "";
  h.lastOrganizationIdByUser = {};
}

// The sync hook decides whether membership is knowable before handing it to the
// reconciler. Getting that wrong in the "still loading" direction is the
// dangerous case: an empty list would look like "you belong nowhere" and clear
// a perfectly valid selection.
describe("useOrganizationSync — membership gating", () => {
  beforeEach(resetMocks);

  it("leaves the selection alone while the organization list is loading", () => {
    h.listState = { organizations: [], isLoading: true, isError: false };
    h.currentOrganizationId = "org-1";

    renderHook(() => useOrganizationSync());

    expect(h.setCurrentOrganizationId).not.toHaveBeenCalled();
  });

  it("leaves the selection alone when the organization list errors", () => {
    h.listState = {
      organizations: [],
      isLoading: false,
      isError: new Error("boom"),
    };
    h.currentOrganizationId = "org-1";

    renderHook(() => useOrganizationSync());

    expect(h.setCurrentOrganizationId).not.toHaveBeenCalled();
  });

  it("does not select a default while the list is still loading", () => {
    h.listState = { organizations: [], isLoading: true, isError: false };
    h.currentOrganizationId = "";

    renderHook(() => useOrganizationSync());

    expect(h.setCurrentOrganizationId).not.toHaveBeenCalled();
  });

  it("reconciles once the list has genuinely loaded", () => {
    h.currentOrganizationId = "org-gone";

    renderHook(() => useOrganizationSync());

    expect(h.setCurrentOrganizationId).toHaveBeenCalledWith("org-1");
  });

  it("keeps a selection that is still in the loaded list", () => {
    h.currentOrganizationId = "org-2";

    renderHook(() => useOrganizationSync());

    expect(h.setCurrentOrganizationId).not.toHaveBeenCalled();
  });
});

describe("useOrganizationSync — remembering the last organization", () => {
  beforeEach(resetMocks);

  it("selects the current user's remembered organization on login", () => {
    h.lastOrganizationIdByUser = { "user-1": "org-2" };

    renderHook(() => useOrganizationSync());

    expect(h.setCurrentOrganizationId).toHaveBeenCalledWith("org-2");
    expect(h.setCurrentOrganizationId).not.toHaveBeenCalledWith("org-1");
  });

  it("does not reconcile again on an unrelated re-render", () => {
    h.lastOrganizationIdByUser = { "user-1": "org-2" };

    const { rerender } = renderHook(() => useOrganizationSync());
    rerender();

    expect(h.setCurrentOrganizationId).toHaveBeenCalledTimes(1);
  });

  it("ignores another user's remembered organization", () => {
    h.lastOrganizationIdByUser = { "user-2": "org-2" };

    renderHook(() => useOrganizationSync());

    expect(h.setCurrentOrganizationId).toHaveBeenCalledWith("org-1");
  });

  it("forgets the user's remembered organization once they leave it", () => {
    h.lastOrganizationIdByUser = { "user-1": "org-gone" };

    renderHook(() => useOrganizationSync());

    expect(h.forgetOrganizationForUser).toHaveBeenCalledWith("user-1");
    expect(h.setCurrentOrganizationId).toHaveBeenCalledWith("org-1");
  });

  it("does not remember an automatic fallback", () => {
    renderHook(() => useOrganizationSync());

    expect(h.rememberOrganizationForUser).not.toHaveBeenCalled();
  });
});
