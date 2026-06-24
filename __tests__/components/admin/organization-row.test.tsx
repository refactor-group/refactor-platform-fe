import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { OrganizationRow } from "@/components/ui/admin/organization-row";
import type { Organization } from "@/types/organization";

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

const mockArchive = vi.fn();
const mockUnarchive = vi.fn();
vi.mock("@/lib/api/organizations", () => ({
  OrganizationApi: {
    archive: (...args: unknown[]) => mockArchive(...args),
    unarchive: (...args: unknown[]) => mockUnarchive(...args),
  },
  // child dialogs call this hook even while closed
  useOrganizationMutation: () => ({
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    isLoading: false,
  }),
}));

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    name: "Acme",
    slug: "acme",
    logo: "",
    archived_at: null,
    created_at: DateTime.fromISO("2024-01-01T00:00:00.000Z"),
    updated_at: DateTime.fromISO("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("OrganizationRow archive lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArchive.mockResolvedValue(makeOrg({ archived_at: "2026-01-01" }));
    mockUnarchive.mockResolvedValue(makeOrg());
  });

  it("active org: shows Archive action, no badge, calls archive + refresh", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    render(<OrganizationRow organization={makeOrg()} onChanged={onChanged} />);

    expect(screen.queryByText("Archived")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Organization actions" })
    );
    await user.click(await screen.findByRole("menuitem", { name: "Archive" }));

    await waitFor(() => expect(mockArchive).toHaveBeenCalledWith("org-1"));
    expect(mockUnarchive).not.toHaveBeenCalled();
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("archived org: shows badge + Unarchive action, calls unarchive", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    render(
      <OrganizationRow
        organization={makeOrg({ archived_at: "2026-01-01T00:00:00.000Z" })}
        onChanged={onChanged}
      />
    );

    expect(screen.getByText("Archived")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Organization actions" })
    );
    await user.click(await screen.findByRole("menuitem", { name: "Unarchive" }));

    await waitFor(() => expect(mockUnarchive).toHaveBeenCalledWith("org-1"));
    expect(mockArchive).not.toHaveBeenCalled();
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
