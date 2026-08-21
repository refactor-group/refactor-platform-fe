import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SidebarState } from "@/types/sidebar";

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
  sidebar: {
    state: "expanded" as string,
    isMobile: false,
    setOpenMobile: vi.fn(),
    expand: vi.fn(),
  },
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
  }),
}));

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ userId: "user-1", isLoggedIn: true, setIsACoach: vi.fn() }),
}));

vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => h.sidebar,
}));

import { OrganizationSwitcher } from "@/components/ui/organization-switcher";

// The switcher decides whether membership is knowable before handing it to the
// reconciler. Getting that wrong in the "still loading" direction is the
// dangerous case: an empty list would look like "you belong nowhere" and clear
// a perfectly valid selection.
describe("OrganizationSwitcher — membership gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.listState = {
      organizations: h.ORGANIZATIONS,
      isLoading: false,
      isError: false,
    };
    h.currentOrganizationId = "";
    h.sidebar = {
      state: SidebarState.Expanded,
      isMobile: false,
      setOpenMobile: vi.fn(),
      expand: vi.fn(),
    };
  });

  it("leaves the selection alone while the organization list is loading", () => {
    h.listState = { organizations: [], isLoading: true, isError: false };
    h.currentOrganizationId = "org-1";

    render(<OrganizationSwitcher />);

    expect(h.setCurrentOrganizationId).not.toHaveBeenCalled();
  });

  it("leaves the selection alone when the organization list errors", () => {
    h.listState = {
      organizations: [],
      isLoading: false,
      isError: new Error("boom"),
    };
    h.currentOrganizationId = "org-1";

    render(<OrganizationSwitcher />);

    expect(h.setCurrentOrganizationId).not.toHaveBeenCalled();
  });

  it("does not select a default while the list is still loading", () => {
    h.listState = { organizations: [], isLoading: true, isError: false };
    h.currentOrganizationId = "";

    render(<OrganizationSwitcher />);

    expect(h.setCurrentOrganizationId).not.toHaveBeenCalled();
  });

  it("reconciles once the list has genuinely loaded", () => {
    h.currentOrganizationId = "org-gone";

    render(<OrganizationSwitcher />);

    expect(h.setCurrentOrganizationId).toHaveBeenCalledWith("org-1");
  });

  it("keeps a selection that is still in the loaded list", () => {
    h.currentOrganizationId = "org-2";

    render(<OrganizationSwitcher />);

    expect(h.setCurrentOrganizationId).not.toHaveBeenCalled();
  });
});
