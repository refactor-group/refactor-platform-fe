import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { OrganizationFormDialog } from "@/components/ui/admin/organization-form-dialog";
import type { Organization } from "@/types/organization";

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/api/organizations", () => ({
  useOrganizationMutation: () => ({
    create: mockCreate,
    update: mockUpdate,
    delete: vi.fn(),
    isLoading: false,
  }),
}));

const existingOrg: Organization = {
  id: "org-1",
  name: "Acme",
  slug: "acme",
  logo: "",
  created_at: DateTime.fromISO("2024-01-01T00:00:00.000Z"),
  updated_at: DateTime.fromISO("2024-01-01T00:00:00.000Z"),
};

describe("OrganizationFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue(existingOrg);
    mockUpdate.mockResolvedValue(existingOrg);
  });

  it("creates an organization with the entered name", async () => {
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <OrganizationFormDialog
        open
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />
    );

    expect(screen.getByText("Add organization")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "New Org" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Org" })
    );
    expect(mockUpdate).not.toHaveBeenCalled();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("updates an existing organization when given one", async () => {
    const onSaved = vi.fn();
    render(
      <OrganizationFormDialog
        open
        onOpenChange={vi.fn()}
        organization={existingOrg}
        onSaved={onSaved}
      />
    );

    expect(screen.getByText("Edit organization")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Acme");

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Acme Renamed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ name: "Acme Renamed", slug: "acme" })
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("surfaces an error toast when the mutation fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("boom"));
    render(
      <OrganizationFormDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Doomed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
  });
});
