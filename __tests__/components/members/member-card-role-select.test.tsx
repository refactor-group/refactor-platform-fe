import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test-utils/msw-server";
import { MemberCard } from "@/components/ui/members/member-card";
import { Role, type UserRole, type UserRoleState } from "@/types/user";
import { PERMISSION_DENIED_MESSAGE } from "@/types/general";
import { toast } from "sonner";
import { createMockUser, createMockUserRole } from "../../test-utils";

// ── Module mocks ──────────────────────────────────────────────────────────────

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

// Partial: the Select derives from the real getOrganizationMembershipRole, so
// only the relationship-driven helpers are stubbed.
vi.mock("@/lib/utils/user-roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/user-roles")>()),
  getUserDisplayRoles: () => [],
  getUserCoaches: () => [],
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const adminRole: UserRoleState = {
  status: "success",
  role: Role.Admin,
  hasAccess: true,
};

const memberRole: UserRoleState = {
  status: "success",
  role: Role.User,
  hasAccess: true,
};

const SELECT_NAME = "Role for Ada Lovelace";

function renderCard(options?: {
  roles?: UserRole[];
  viewerRoleState?: UserRoleState;
}) {
  const cardUser = createMockUser({
    id: "user-1",
    first_name: "Ada",
    last_name: "Lovelace",
    invite_status: null,
    roles: options?.roles ?? [
      createMockUserRole({ role: Role.User, organization_id: "org-1" }),
    ],
  });
  render(
    <MemberCard
      user={cardUser}
      currentUserId="me"
      userRelationships={[]}
      onRefresh={vi.fn()}
      users={[cardUser]}
      currentUserRoleState={options?.viewerRoleState ?? adminRole}
    />
  );
}

function captureRolePuts(response: () => Response) {
  const bodies: unknown[] = [];
  const urls: string[] = [];
  server.use(
    http.put(
      "*/organizations/:organizationId/users/:userId/role",
      async ({ request }) => {
        urls.push(new URL(request.url).pathname);
        bodies.push(await request.json());
        return response();
      }
    )
  );
  return { bodies, urls };
}

async function selectRole(
  user: ReturnType<typeof userEvent.setup>,
  option: "Member" | "Admin"
) {
  await user.click(screen.getByRole("combobox", { name: SELECT_NAME }));
  await user.click(await screen.findByRole("option", { name: option }));
}

const LAST_ADMIN_BODY = {
  details: { organization_id: "org-1" },
  error: "last_organization_admin",
  message:
    "This user is the only admin of this organization. Grant another member the Admin role first.",
  status_code: 409,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  mockAuthStore.mockReturnValue({ isACoach: true, userSession: { id: "me" } });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MemberCard – role select", () => {
  it("shows an admin the member's current role", async () => {
    renderCard();

    expect(
      screen.getByRole("combobox", { name: SELECT_NAME })
    ).toHaveTextContent("Member");
  });

  it("shows an admin role as Admin", async () => {
    renderCard({
      roles: [createMockUserRole({ role: Role.Admin, organization_id: "org-1" })],
    });

    expect(
      screen.getByRole("combobox", { name: SELECT_NAME })
    ).toHaveTextContent("Admin");
  });

  it("hides the control from a non-admin viewer", () => {
    renderCard({ viewerRoleState: memberRole });

    expect(
      screen.queryByRole("combobox", { name: SELECT_NAME })
    ).not.toBeInTheDocument();
  });

  it("disables the control on the viewer's own row", () => {
    mockAuthStore.mockReturnValue({
      isACoach: true,
      userSession: { id: "user-1" },
    });
    renderCard();

    expect(screen.getByRole("combobox", { name: SELECT_NAME })).toBeDisabled();
  });

  it("renders no control for a global SuperAdmin with no membership in this org", () => {
    renderCard({
      roles: [
        createMockUserRole({ role: Role.SuperAdmin, organization_id: null }),
      ],
    });

    expect(
      screen.queryByRole("combobox", { name: SELECT_NAME })
    ).not.toBeInTheDocument();
  });

  it("issues one PUT of the chosen role to the membership sub-route", async () => {
    const { bodies, urls } = captureRolePuts(() =>
      HttpResponse.json({ status_code: 200, data: null })
    );
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("combobox", { name: SELECT_NAME }));
    await user.click(await screen.findByRole("option", { name: "Admin" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ role: "Admin" });
    expect(urls[0]).toBe("/organizations/org-1/users/user-1/role");
  });

  it("reports the last-admin 409 inline on the row, not as a toast", async () => {
    captureRolePuts(() => HttpResponse.json(LAST_ADMIN_BODY, { status: 409 }));
    const user = userEvent.setup();
    renderCard({
      roles: [createMockUserRole({ role: Role.Admin, organization_id: "org-1" })],
    });

    await selectRole(user, "Member");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(LAST_ADMIN_BODY.message);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("rolls the select back to the pre-change role after the last-admin 409", async () => {
    captureRolePuts(() => HttpResponse.json(LAST_ADMIN_BODY, { status: 409 }));
    const user = userEvent.setup();
    renderCard({
      roles: [createMockUserRole({ role: Role.Admin, organization_id: "org-1" })],
    });

    await selectRole(user, "Member");

    await screen.findByRole("alert");
    expect(
      screen.getByRole("combobox", { name: SELECT_NAME })
    ).toHaveTextContent("Admin");
  });

  it("keys the inline branch off the slug, not the message prose", async () => {
    const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
    captureRolePuts(() =>
      HttpResponse.json({ ...LAST_ADMIN_BODY, message: lorem }, { status: 409 })
    );
    const user = userEvent.setup();
    renderCard({
      roles: [createMockUserRole({ role: Role.Admin, organization_id: "org-1" })],
    });

    await selectRole(user, "Member");

    expect(await screen.findByRole("alert")).toHaveTextContent(lorem);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("clears the inline message once a later role change succeeds", async () => {
    let body: unknown = LAST_ADMIN_BODY;
    let status = 409;
    captureRolePuts(() => HttpResponse.json(body, { status }));
    const user = userEvent.setup();
    renderCard({
      roles: [createMockUserRole({ role: Role.Admin, organization_id: "org-1" })],
    });

    await selectRole(user, "Member");
    await screen.findByRole("alert");

    body = { status_code: 200, data: null };
    status = 200;
    await selectRole(user, "Member");

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    );
  });

  it("toasts the archived-organization 409 without an inline message", async () => {
    captureRolePuts(() =>
      HttpResponse.json(
        {
          error: "organization_archived",
          message: "This organization is archived.",
          status_code: 409,
        },
        { status: 409 }
      )
    );
    const user = userEvent.setup();
    renderCard();

    await selectRole(user, "Admin");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("This organization is archived.")
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("toasts the SuperAdmin 422 without an inline message", async () => {
    const message = "SuperAdmin cannot be granted within an organization.";
    captureRolePuts(() =>
      HttpResponse.json(
        { status_code: 422, error: "validation_error", message },
        { status: 422 }
      )
    );
    const user = userEvent.setup();
    renderCard();

    await selectRole(user, "Admin");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports a bare-string 403 as a permission error", async () => {
    captureRolePuts(
      () => new HttpResponse("FORBIDDEN", { status: 403 }) as Response
    );
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("combobox", { name: SELECT_NAME }));
    await user.click(await screen.findByRole("option", { name: "Admin" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(PERMISSION_DENIED_MESSAGE)
    );
  });
});
