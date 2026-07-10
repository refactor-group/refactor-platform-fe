import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddMemberDialog } from "@/components/ui/members/add-member-dialog";
import { EntityApiError } from "@/types/entity-api-error";

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: (...a: unknown[]) => mockToastSuccess(...a),
    error: (...a: unknown[]) => mockToastError(...a),
  }),
}));

const mockCreateNested = vi.fn();
vi.mock("@/lib/api/organizations/users", () => ({
  useUserMutation: () => ({ createNested: mockCreateNested }),
}));

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));

vi.mock("@/lib/timezone-utils", () => ({
  getBrowserTimezone: () => "UTC",
}));

function apiError(status: number, data: unknown): EntityApiError {
  const axiosLike = Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: { status, statusText: "Conflict", data },
  });
  return new EntityApiError("POST", "/organizations/org-1/users", axiosLike);
}

function fillForm() {
  fireEvent.change(screen.getByLabelText("First Name"), {
    target: { value: "Ada" },
  });
  fireEvent.change(screen.getByLabelText("Last Name"), {
    target: { value: "Lovelace" },
  });
  fireEvent.change(screen.getByLabelText("Display Name"), {
    target: { value: "Ada" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "ada@example.com" },
  });
}

describe("AddMemberDialog write-freeze handling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("surfaces the backend message when the org is archived", async () => {
    mockCreateNested.mockRejectedValueOnce(
      apiError(409, {
        error: "organization_archived",
        message: "This organization is archived and cannot accept new changes.",
      })
    );
    render(
      <AddMemberDialog open onOpenChange={vi.fn()} onMemberAdded={vi.fn()} />
    );

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Member" }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "This organization is archived and cannot accept new changes."
      )
    );
  });

  it("shows the permission-denied message on a 403", async () => {
    mockCreateNested.mockRejectedValueOnce(apiError(403, { error: "forbidden" }));
    render(
      <AddMemberDialog open onOpenChange={vi.fn()} onMemberAdded={vi.fn()} />
    );

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Member" }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "You don't have permission to perform this action."
      )
    );
  });

  it("falls back to the generic message for other errors", async () => {
    mockCreateNested.mockRejectedValueOnce(new Error("network"));
    render(
      <AddMemberDialog open onOpenChange={vi.fn()} onMemberAdded={vi.fn()} />
    );

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create Member" }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "There was an error adding the member"
      )
    );
  });
});
