import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { organizationToSwitchTo } from "@/lib/coaching-session-organization";
import { useSyncOrganizationFromSession } from "@/lib/hooks/use-sync-organization-from-session";
import type { OrganizationMembership } from "@/lib/hooks/use-reconcile-current-organization";
import { useOrganizationList } from "@/lib/api/organizations";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { serializeCoachingSession, transformCoachingSession } from "@/types/coaching-session";
import type { CoachingSession } from "@/types/coaching-session";
import { None, Some } from "@/types/option";
import { createMockOrganization, createMockSession } from "../test-utils";

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ userId: "user-1", isLoggedIn: true }),
}));
vi.mock("@/lib/api/organizations", () => ({ useOrganizationList: vi.fn() }));
vi.mock("@/lib/hooks/use-current-organization", () => ({ useCurrentOrganization: vi.fn() }));

const ACME = createMockOrganization({ id: "org-acme", name: "Acme Corp" });
const BIGTABLE = createMockOrganization({ id: "org-bigtable", name: "BigTable" });
const loaded = (organizations = [ACME, BIGTABLE]): OrganizationMembership => ({ kind: "loaded", organizations });

describe("organizationToSwitchTo", () => {
  it("switches to the session's organization when it differs and the user is a member", () => {
    expect(
      organizationToSwitchTo({
        sessionOrganizationId: Some("org-bigtable"),
        currentOrganizationId: "org-acme",
        membership: loaded(),
      })
    ).toEqual(Some("org-bigtable"));
  });

  it("stays put when the session is already in the selected organization", () => {
    expect(
      organizationToSwitchTo({
        sessionOrganizationId: Some("org-acme"),
        currentOrganizationId: "org-acme",
        membership: loaded(),
      })
    ).toEqual(None);
  });

  it("stays put when the user isn't a member there (a global super admin)", () => {
    expect(
      organizationToSwitchTo({
        sessionOrganizationId: Some("org-bigtable"),
        currentOrganizationId: "org-acme",
        membership: loaded([ACME]),
      })
    ).toEqual(None);
  });

  it("waits until memberships have loaded", () => {
    expect(
      organizationToSwitchTo({
        sessionOrganizationId: Some("org-bigtable"),
        currentOrganizationId: "org-acme",
        membership: { kind: "unknown" },
      })
    ).toEqual(None);
  });

  it("does nothing without the session's organization", () => {
    expect(
      organizationToSwitchTo({ sessionOrganizationId: None, currentOrganizationId: "org-acme", membership: loaded() })
    ).toEqual(None);
  });

  it("selects the session's organization when none is selected yet", () => {
    expect(
      organizationToSwitchTo({
        sessionOrganizationId: Some("org-bigtable"),
        currentOrganizationId: "",
        membership: loaded(),
      })
    ).toEqual(Some("org-bigtable"));
  });
});

describe("organization_id on the wire", () => {
  const raw = (organizationId?: string) => ({
    id: "s-1",
    coaching_relationship_id: "rel-1",
    date: "2026-11-10T14:30:00",
    duration_minutes: 50,
    title: null,
    coaching_session_series_id: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...(organizationId === undefined ? {} : { organization_id: organizationId }),
  });

  it("reads it as Some on the single-session read and None where it's absent", () => {
    expect(transformCoachingSession(raw("org-bigtable")).organization_id).toEqual(Some("org-bigtable"));
    expect(transformCoachingSession(raw()).organization_id).toEqual(None);
  });

  it("never sends it back on a write", () => {
    expect(serializeCoachingSession(transformCoachingSession(raw("org-bigtable")))).not.toHaveProperty(
      "organization_id"
    );
  });
});

describe("useSyncOrganizationFromSession", () => {
  const setCurrentOrganizationId = vi.fn();
  const rememberOrganizationForUser = vi.fn();

  function serve(current: string, organizations = [ACME, BIGTABLE], isLoading = false) {
    vi.mocked(useCurrentOrganization).mockReturnValue({
      currentOrganizationId: current,
      setCurrentOrganizationId,
      rememberOrganizationForUser,
    } as unknown as ReturnType<typeof useCurrentOrganization>);
    vi.mocked(useOrganizationList).mockReturnValue({
      organizations,
      isLoading,
      isError: false,
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useOrganizationList>);
  }

  const session = (organizationId: string): CoachingSession =>
    ({ ...createMockSession({ id: "s-1" }), organization_id: Some(organizationId) }) as CoachingSession;

  beforeEach(() => vi.clearAllMocks());

  it("selects the session's organization once, without changing the remembered one", () => {
    serve("org-acme");
    const { rerender } = renderHook(() => useSyncOrganizationFromSession(Some(session("org-bigtable"))));
    rerender();
    expect(setCurrentOrganizationId).toHaveBeenCalledTimes(1);
    expect(setCurrentOrganizationId).toHaveBeenCalledWith("org-bigtable");
    expect(rememberOrganizationForUser).not.toHaveBeenCalled();
  });

  it("leaves the selection alone for a session in the selected organization", () => {
    serve("org-acme");
    renderHook(() => useSyncOrganizationFromSession(Some(session("org-acme"))));
    expect(setCurrentOrganizationId).not.toHaveBeenCalled();
  });

  it("leaves the selection alone when the user isn't a member of the session's organization", () => {
    serve("org-acme", [ACME]);
    renderHook(() => useSyncOrganizationFromSession(Some(session("org-bigtable"))));
    expect(setCurrentOrganizationId).not.toHaveBeenCalled();
  });

  it("waits for the session and for the user's organizations", () => {
    serve("org-acme", [], true);
    renderHook(() => useSyncOrganizationFromSession(Some(session("org-bigtable"))));
    serve("org-acme");
    renderHook(() => useSyncOrganizationFromSession(None));
    expect(setCurrentOrganizationId).not.toHaveBeenCalled();
  });
});
