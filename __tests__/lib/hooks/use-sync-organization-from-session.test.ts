import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSyncOrganizationFromSession } from "@/lib/hooks/use-sync-organization-from-session";
import type { CoachingSession } from "@/types/coaching-session";
import { None, Some, type Option } from "@/types/option";
import { createMockSession } from "../../test-utils";

const org = { current: "acme" };
const memberships = { organizations: [{ id: "acme" }, { id: "bigtable" }], isLoading: false };
const rememberOrganizationForUser = vi.fn();
const setCurrentOrganizationId = vi.fn((id: string) => {
  org.current = id;
});

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ userId: "me", isLoggedIn: true }),
}));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({
    currentOrganizationId: org.current,
    setCurrentOrganizationId,
    rememberOrganizationForUser,
  }),
}));
vi.mock("@/lib/api/organizations", () => ({
  useOrganizationList: () => ({ ...memberships, isError: false }),
}));

function sessionIn(id: string, organizationId: string): Option<CoachingSession> {
  return Some({ ...createMockSession({ id }), organization_id: Some(organizationId) });
}

/** Renders on a session, then lets the test pick an organization the way the user menu does. */
function openSession(session: Option<CoachingSession>) {
  const hook = renderHook(({ s }) => useSyncOrganizationFromSession(s), { initialProps: { s: session } });
  // The store's update renders the page again, as it does in the app.
  hook.rerender({ s: session });
  const pick = (id: string) =>
    act(() => {
      org.current = id;
      hook.rerender({ s: session });
    });
  return { ...hook, pick };
}

beforeEach(() => {
  org.current = "acme";
  memberships.organizations = [{ id: "acme" }, { id: "bigtable" }];
  memberships.isLoading = false;
  vi.clearAllMocks();
});

describe("useSyncOrganizationFromSession", () => {
  it("selects the session's organization once, without remembering it", () => {
    openSession(sessionIn("s-1", "bigtable"));
    expect(setCurrentOrganizationId).toHaveBeenCalledTimes(1);
    expect(setCurrentOrganizationId).toHaveBeenCalledWith("bigtable");
    expect(rememberOrganizationForUser).not.toHaveBeenCalled();
  });

  it("leaves the selection alone when the user isn't a member there", () => {
    memberships.organizations = [{ id: "acme" }];
    openSession(sessionIn("s-1", "bigtable"));
    expect(setCurrentOrganizationId).not.toHaveBeenCalled();
  });

  it("waits for the user's organizations, then selects", () => {
    memberships.isLoading = true;
    const { rerender } = openSession(sessionIn("s-1", "bigtable"));
    expect(setCurrentOrganizationId).not.toHaveBeenCalled();
    memberships.isLoading = false;
    rerender({ s: sessionIn("s-1", "bigtable") });
    expect(setCurrentOrganizationId).toHaveBeenCalledWith("bigtable");
  });

  it("leaves a later switch from the user menu alone", () => {
    const { pick } = openSession(sessionIn("s-1", "bigtable"));
    setCurrentOrganizationId.mockClear();
    pick("acme");
    expect(setCurrentOrganizationId).not.toHaveBeenCalled();
    expect(org.current).toBe("acme");
  });

  it("leaves a switch alone when the session opened in its own organization", () => {
    const { pick } = openSession(sessionIn("s-1", "acme"));
    pick("bigtable");
    expect(setCurrentOrganizationId).not.toHaveBeenCalled();
  });

  it("syncs again for another session", () => {
    const { rerender } = openSession(sessionIn("s-1", "acme"));
    rerender({ s: sessionIn("s-2", "bigtable") });
    expect(setCurrentOrganizationId).toHaveBeenCalledWith("bigtable");
  });

  it("waits for the session", () => {
    const { rerender } = openSession(None);
    expect(setCurrentOrganizationId).not.toHaveBeenCalled();
    rerender({ s: sessionIn("s-1", "bigtable") });
    expect(setCurrentOrganizationId).toHaveBeenCalledWith("bigtable");
  });
});
