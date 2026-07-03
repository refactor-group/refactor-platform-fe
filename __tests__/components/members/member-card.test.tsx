import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemberCard } from "@/components/ui/members/member-card";
import { EntityApiError } from "@/types/entity-api-error";
import { Role, type UserRoleState } from "@/types/user";
import { toast } from "sonner";
import { createMockUser } from "../../test-utils";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));

const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  AuthStoreProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

const mockResendInvite = vi.fn();
const mockDeleteNested = vi.fn();
vi.mock("@/lib/api/organizations/users", () => ({
  UserApi: { resendInvite: (...a: unknown[]) => mockResendInvite(...a) },
  useUserMutation: () => ({ error: undefined, deleteNested: mockDeleteNested }),
}));

const mockCreateRelationship = vi.fn();
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipMutation: () => ({
    createNested: mockCreateRelationship,
  }),
}));

// Role derivation is pure and covered elsewhere; stub it so the card renders
// without needing full relationship fixtures.
vi.mock("@/lib/utils/user-roles", () => ({
  getUserDisplayRoles: () => [],
  getUserCoaches: () => [],
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const adminRole: UserRoleState = {
  status: "success",
  role: Role.Admin,
  hasAccess: true,
};

// A real EntityApiError carrying the given status/body, so the card's real
// isForbiddenError / organizationArchivedMessage helpers behave as in prod.
function apiError(status: number, data: unknown = {}): EntityApiError {
  const axiosLike = Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: { status, statusText: "Error", data },
  });
  return new EntityApiError("POST", "/api", axiosLike);
}

function renderCard(userOverrides = {}, users = undefined as unknown) {
  const cardUser = createMockUser({
    id: "user-1",
    first_name: "Ada",
    last_name: "Lovelace",
    invite_status: null,
    ...userOverrides,
  });
  const otherUser = createMockUser({
    id: "user-2",
    first_name: "Bob",
    last_name: "Jones",
  });
  render(
    <MemberCard
      user={cardUser}
      currentUserId="me"
      userRelationships={[]}
      onRefresh={vi.fn()}
      users={(users as never) ?? [cardUser, otherUser]}
      currentUserRoleState={adminRole}
    />
  );
}

// Drives the "Assign Coach" flow: open the row menu, pick Assign Coach, choose a
// member in the dialog's Select, then submit. Leaves the createRelationship
// rejection to the caller.
async function submitAssignCoach(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button")); // row actions menu (icon-only)
  await user.click(await screen.findByText("Assign Coach")); // menu item → opens dialog
  await user.click(screen.getByRole("combobox")); // open member Select
  await user.click(await screen.findByText("Bob Jones")); // choose assignee
  await user.click(screen.getByRole("button", { name: /assign as coach/i }));
}

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  mockAuthStore.mockReturnValue({
    isACoach: true,
    userSession: { id: "me" },
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MemberCard – resend invite error handling", () => {
  it("shows the permission-denied toast on a 403", async () => {
    mockResendInvite.mockRejectedValueOnce(apiError(403));
    const user = userEvent.setup();
    renderCard({ invite_status: "expired" });

    await user.click(screen.getByRole("button", { name: /resend/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "You don't have permission to perform this action."
      )
    );
  });

  it("falls back to the generic message for other errors", async () => {
    mockResendInvite.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    renderCard({ invite_status: "expired" });

    await user.click(screen.getByRole("button", { name: /resend/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to resend invitation")
    );
  });
});

describe("MemberCard – assign relationship error handling", () => {
  it("surfaces the backend message when the org is archived", async () => {
    mockCreateRelationship.mockRejectedValueOnce(
      apiError(409, {
        error: "organization_archived",
        message: "This organization is archived and cannot accept new changes.",
      })
    );
    const user = userEvent.setup();
    renderCard();

    await submitAssignCoach(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This organization is archived and cannot accept new changes."
      )
    );
  });

  it("shows the permission-denied toast on a 403", async () => {
    mockCreateRelationship.mockRejectedValueOnce(apiError(403));
    const user = userEvent.setup();
    renderCard();

    await submitAssignCoach(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "You don't have permission to perform this action."
      )
    );
  });

  it("falls back to the generic assign message for other errors", async () => {
    mockCreateRelationship.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    renderCard();

    await submitAssignCoach(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Error assigning Coach")
    );
  });
});
