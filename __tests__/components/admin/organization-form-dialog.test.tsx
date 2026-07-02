import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { OrganizationFormDialog } from "@/components/ui/admin/organization-form-dialog";
import { EntityApiError } from "@/types/entity-api-error";
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

function makeApiError(status: number, data: unknown): EntityApiError {
  const axiosLikeError = Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: { status, statusText: "Conflict", data },
  });
  return new EntityApiError("POST", "/organizations", axiosLikeError);
}

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

  it("shows an inline name error on organization_name_taken (no toast)", async () => {
    mockCreate.mockRejectedValueOnce(
      makeApiError(409, {
        status_code: 409,
        error: "organization_name_taken",
        message: "An organization with that name already exists.",
        details: { name: "Acme" },
      })
    );
    const onOpenChange = vi.fn();
    render(
      <OrganizationFormDialog open onOpenChange={onOpenChange} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Acme" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() =>
      expect(
        screen.getByText("An organization with that name already exists.")
      ).toBeInTheDocument()
    );
    expect(mockToastError).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("blocks submit with an inline error on an empty name (no request)", async () => {
    render(
      <OrganizationFormDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() =>
      expect(
        screen.getByText("Organization name must not be empty.")
      ).toBeInTheDocument()
    );
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("blocks submit with an inline error on a name over 255 chars (no request)", async () => {
    render(
      <OrganizationFormDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "a".repeat(256) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Organization name must be at most 255 characters (got 256)."
        )
      ).toBeInTheDocument()
    );
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("shows an inline name error on a server 422 validation_error (no toast)", async () => {
    // A name that passes the client check but the server rejects (e.g. a
    // grapheme the BE counts differently); proves the 422 fallback wires in.
    mockCreate.mockRejectedValueOnce(
      makeApiError(422, {
        status_code: 422,
        error: "validation_error",
        message: "Organization name must be at most 255 characters (got 812).",
      })
    );
    const onOpenChange = vi.fn();
    render(
      <OrganizationFormDialog open onOpenChange={onOpenChange} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Valid Enough" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Organization name must be at most 255 characters (got 812)."
        )
      ).toBeInTheDocument()
    );
    expect(mockToastError).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("shows an inline name error on a rename collision (update path)", async () => {
    mockUpdate.mockRejectedValueOnce(
      makeApiError(409, {
        status_code: 409,
        error: "organization_name_taken",
        message: "An organization with that name already exists.",
        details: { name: "Pybites" },
      })
    );
    render(
      <OrganizationFormDialog
        open
        onOpenChange={vi.fn()}
        organization={existingOrg}
        onSaved={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Pybites" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(
      screen.getByText("An organization with that name already exists.")
    ).toBeInTheDocument();
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
