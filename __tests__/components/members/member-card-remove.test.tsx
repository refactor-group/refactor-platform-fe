import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test-utils/msw-server";
import { MemberCard } from "@/components/ui/members/member-card";
import { Role, type UserRoleState } from "@/types/user";
import { toast } from "sonner";
import { createMockUser } from "../../test-utils";

// ── Module mocks ──────────────────────────────────────────────────────────────

// A concrete base URL so msw can match the real API calls this card makes.
vi.mock("@/site.config", () => ({
  siteConfig: {
    env: {
      backendServiceURL: "http://localhost:4000",
      backendApiVersion: "1.0.0-test",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({
    currentOrganizationId: "org-1",
    currentOrganization: { id: "org-1", name: "Acme Corp" },
  }),
}));

const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  AuthStoreProvider: ({ children }: { children: ReactNode }) => children,
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipMutation: () => ({ createNested: vi.fn() }),
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

function renderCard() {
  const cardUser = createMockUser({
    id: "user-1",
    first_name: "Ada",
    last_name: "Lovelace",
    invite_status: null,
  });
  render(
    <MemberCard
      user={cardUser}
      currentUserId="me"
      userRelationships={[]}
      onRefresh={vi.fn()}
      users={[cardUser]}
      currentUserRoleState={adminRole}
    />
  );
}

/**
 * Records both the membership DELETE and the account DELETE, so a regression
 * that removes the whole account instead of the membership is visible.
 */
function captureDeletes(membershipResponse: () => Response) {
  const roleCalls: string[] = [];
  const accountCalls: string[] = [];
  server.use(
    http.delete(
      "*/organizations/:organizationId/users/:userId/role",
      ({ request }) => {
        roleCalls.push(request.url);
        return membershipResponse();
      }
    ),
    http.delete("*/organizations/:organizationId/users/:userId", ({ request }) => {
      accountCalls.push(request.url);
      return HttpResponse.json({ status_code: 200, data: null });
    })
  );
  return { roleCalls, accountCalls };
}

async function openRemoveDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button")); // row actions menu (icon-only)
  await user.click(await screen.findByText("Remove from organization"));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  mockAuthStore.mockReturnValue({ isACoach: true, userSession: { id: "me" } });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MemberCard – remove from organization", () => {
  it("offers the action to an admin viewing another member", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button"));

    expect(
      await screen.findByText("Remove from organization")
    ).toBeInTheDocument();
  });

  it("deletes the membership sub-route, never the member's account", async () => {
    const { roleCalls, accountCalls } = captureDeletes(() =>
      HttpResponse.json({ status_code: 200, data: null })
    );
    const user = userEvent.setup();
    renderCard();

    await openRemoveDialog(user);
    // Naming the organization matters here: an admin who administers several
    // should not have to infer which one they are removing someone from.
    expect(
      await screen.findByText(/Remove Ada Lovelace from Acme Corp/)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /They immediately lose access to this organization's coaching sessions, notes and actions\./
      )
    ).toBeInTheDocument();
    expect(await screen.findByText("Nothing is deleted.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(roleCalls).toHaveLength(1));
    expect(roleCalls[0]).toBe(
      "http://localhost:4000/organizations/org-1/users/user-1/role"
    );
    expect(roleCalls[0].endsWith("/role")).toBe(true);
    expect(accountCalls).toEqual([]);
  });

  it("surfaces the last-admin conflict rather than a generic error", async () => {
    captureDeletes(() =>
      HttpResponse.json(
        {
          error: "last_organization_admin",
          message:
            "This user is the only admin of this organization. Assign another admin before removing them.",
        },
        { status: 409 }
      )
    );
    const user = userEvent.setup();
    renderCard();

    await openRemoveDialog(user);
    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This user is the only admin of this organization. Assign another admin before removing them."
      )
    );
  });
});
