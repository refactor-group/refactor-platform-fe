import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SidebarState } from "@/types/sidebar";

const h = vi.hoisted(() => ({
  ORGANIZATIONS: [
    { id: "org-1", name: "Acme Corp", slug: "acme-corp" },
    { id: "org-2", name: "Beta Inc", slug: "beta-inc" },
  ],
  setCurrentOrganizationId: vi.fn(),
  setOpenMobile: vi.fn(),
  expand: vi.fn(),
  sidebar: {
    state: "collapsed" as string,
    isMobile: true,
    setOpenMobile: vi.fn(),
    expand: vi.fn(),
  },
}));

vi.mock("@/lib/api/organizations", () => ({
  useOrganizationList: () => ({
    organizations: h.ORGANIZATIONS,
    isLoading: false,
    isError: false,
  }),
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
    currentOrganizationId: "org-1",
    currentOrganization: h.ORGANIZATIONS[0],
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

// The mobile sidebar is a sheet, but the underlying sidebar state stays
// Collapsed on small screens. Keying the icon-only rendering off that state
// alone left mobile users with a bare, unclickable avatar.
describe("OrganizationSwitcher — mobile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.sidebar = {
      state: SidebarState.Collapsed,
      isMobile: true,
      setOpenMobile: h.setOpenMobile,
      expand: h.expand,
    };
  });

  it("renders a real trigger on mobile even though the sidebar state is collapsed", () => {
    render(<OrganizationSwitcher />);

    expect(
      screen.getByRole("button", { name: "Switch organization: Acme Corp" })
    ).toBeInTheDocument();
  });

  it("opens the organization list in a bottom sheet when tapped", async () => {
    const user = userEvent.setup();
    render(<OrganizationSwitcher />);

    await user.click(screen.getByRole("button", { name: /Switch organization/ }));

    expect(screen.getByText("Switch organization")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Beta Inc/ })).toBeInTheDocument();
  });

  it("selects an organization and closes the mobile sidebar behind it", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<OrganizationSwitcher onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /Switch organization/ }));
    await user.click(screen.getByRole("button", { name: /Beta Inc/ }));

    expect(h.setCurrentOrganizationId).toHaveBeenCalledWith("org-2");
    expect(onSelect).toHaveBeenCalledWith("org-2");
    expect(h.setOpenMobile).toHaveBeenCalledWith(false);
  });

  it("keeps the icon-only treatment on the collapsed desktop rail", () => {
    h.sidebar = {
      state: SidebarState.Collapsed,
      isMobile: false,
      setOpenMobile: h.setOpenMobile,
      expand: h.expand,
    };

    render(<OrganizationSwitcher />);

    // The avatar stands in for the trigger, so the name is there but the
    // organization is not spelled out beside it.
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
  });

  it("expands the rail when the collapsed avatar is clicked", async () => {
    const user = userEvent.setup();
    h.sidebar = {
      state: SidebarState.Collapsed,
      isMobile: false,
      setOpenMobile: h.setOpenMobile,
      expand: h.expand,
    };

    render(<OrganizationSwitcher />);
    await user.click(screen.getByRole("button", { name: /Switch organization/ }));

    expect(h.expand).toHaveBeenCalled();
  });
});

describe("OrganizationSwitcher — desktop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.sidebar = {
      state: SidebarState.Expanded,
      isMobile: false,
      setOpenMobile: h.setOpenMobile,
      expand: h.expand,
    };
  });

  it("offers the organizations as menu items", async () => {
    const user = userEvent.setup();
    render(<OrganizationSwitcher />);

    await user.click(screen.getByRole("button", { name: /Switch organization/ }));

    expect(screen.getByRole("menuitem", { name: /Acme Corp/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Beta Inc/ })).toBeInTheDocument();
  });

  it("switches organization from the menu without touching the mobile sidebar", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<OrganizationSwitcher onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /Switch organization/ }));
    await user.click(screen.getByRole("menuitem", { name: /Beta Inc/ }));

    expect(h.setCurrentOrganizationId).toHaveBeenCalledWith("org-2");
    expect(onSelect).toHaveBeenCalledWith("org-2");
    expect(h.setOpenMobile).not.toHaveBeenCalled();
  });
});
