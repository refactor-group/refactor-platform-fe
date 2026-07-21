import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrganizationArchivedByline } from "@/components/ui/admin/organization-archived-byline";
import type { Organization } from "@/types/organization";
import { defaultUser } from "@/types/user";

const mockUseUser = vi.fn();
vi.mock("@/lib/api/users", () => ({
  useUser: (...args: unknown[]) => mockUseUser(...args),
}));

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    name: "Acme",
    slug: "acme",
    logo: "",
    archived_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Organization;
}

describe("OrganizationArchivedByline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the resolved archiver name when the lookup succeeds", () => {
    mockUseUser.mockReturnValue({
      user: { display_name: "Ada Admin", first_name: "Ada", last_name: "Admin" },
      isLoading: false,
      isError: undefined,
    });
    render(<OrganizationArchivedByline organization={makeOrg({ archived_by: "u-1" })} />);
    expect(screen.getByText(/Archived .* by Ada Admin/)).toBeInTheDocument();
  });

  it("shows '…' while the archiver lookup is in flight", () => {
    mockUseUser.mockReturnValue({
      user: defaultUser(),
      isLoading: true,
      isError: undefined,
    });
    render(<OrganizationArchivedByline organization={makeOrg({ archived_by: "u-1" })} />);
    expect(screen.getByText(/by …/)).toBeInTheDocument();
  });

  it("degrades to 'a former admin' when the archiver lookup errors", () => {
    mockUseUser.mockReturnValue({
      user: defaultUser(),
      isLoading: false,
      isError: new Error("403"),
    });
    render(<OrganizationArchivedByline organization={makeOrg({ archived_by: "u-1" })} />);
    expect(screen.getByText(/by a former admin/)).toBeInTheDocument();
  });

  it("reads 'a former admin' when archived_by is absent (no lookup)", () => {
    mockUseUser.mockReturnValue({
      user: defaultUser(),
      isLoading: false,
      isError: undefined,
    });
    render(<OrganizationArchivedByline organization={makeOrg()} />);
    expect(screen.getByText(/by a former admin/)).toBeInTheDocument();
  });
});
