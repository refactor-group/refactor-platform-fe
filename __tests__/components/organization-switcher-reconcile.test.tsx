import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  lastOrganizationIdByUser: {} as Record<string, string>,
  rememberOrganizationForUser: vi.fn(),
  forgetOrganizationForUser: vi.fn(),
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
    lastOrganizationIdByUser: h.lastOrganizationIdByUser,
    rememberOrganizationForUser: h.rememberOrganizationForUser,
    forgetOrganizationForUser: h.forgetOrganizationForUser,
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
    h.lastOrganizationIdByUser = {};
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

describe("OrganizationSwitcher — remembering the last organization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.listState = {
      organizations: h.ORGANIZATIONS,
      isLoading: false,
      isError: false,
    };
    h.currentOrganizationId = "";
    h.lastOrganizationIdByUser = {};
    h.sidebar = {
      state: SidebarState.Expanded,
      isMobile: false,
      setOpenMobile: vi.fn(),
      expand: vi.fn(),
    };
  });

  it("selects the current user's remembered organization on login", () => {
    h.lastOrganizationIdByUser = { "user-1": "org-2" };

    render(<OrganizationSwitcher />);

    expect(h.setCurrentOrganizationId).toHaveBeenCalledWith("org-2");
    expect(h.setCurrentOrganizationId).not.toHaveBeenCalledWith("org-1");
  });

  it("ignores another user's remembered organization", () => {
    h.lastOrganizationIdByUser = { "user-2": "org-2" };

    render(<OrganizationSwitcher />);

    expect(h.setCurrentOrganizationId).toHaveBeenCalledWith("org-1");
  });

  it("forgets the user's remembered organization once they leave it", () => {
    h.lastOrganizationIdByUser = { "user-1": "org-gone" };

    render(<OrganizationSwitcher />);

    expect(h.forgetOrganizationForUser).toHaveBeenCalledWith("user-1");
    expect(h.setCurrentOrganizationId).toHaveBeenCalledWith("org-1");
  });

  it("does not remember an automatic fallback", () => {
    render(<OrganizationSwitcher />);

    expect(h.rememberOrganizationForUser).not.toHaveBeenCalled();
  });

  it("remembers an organization picked from the dropdown", async () => {
    const user = userEvent.setup();
    h.currentOrganizationId = "org-1";
    render(<OrganizationSwitcher />);

    await user.click(screen.getByRole("button", { name: /organization/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /Beta Inc/ })
    );

    expect(h.rememberOrganizationForUser).toHaveBeenCalledWith(
      "user-1",
      "org-2"
    );
    expect(h.setCurrentOrganizationId).toHaveBeenCalledWith("org-2");
  });

  it("remembers an organization picked from the mobile sheet", async () => {
    const user = userEvent.setup();
    h.sidebar.isMobile = true;
    h.currentOrganizationId = "org-1";
    render(<OrganizationSwitcher />);

    await user.click(screen.getByRole("button", { name: /organization/i }));
    await user.click(
      await screen.findByRole("button", { name: /Beta Inc/ })
    );

    expect(h.rememberOrganizationForUser).toHaveBeenCalledWith(
      "user-1",
      "org-2"
    );
  });
});
