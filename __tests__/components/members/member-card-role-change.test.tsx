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

// Partial: the menu item derives from the real getOrganizationMembershipRole, so
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

const MENU_NAME = "Actions for Ada Lovelace";
const PROMOTE = "Promote to Admin";
const DEMOTE = "Revoke admin access";

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

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: MENU_NAME }));
  return screen.findAllByRole("menuitem");
}

async function chooseRoleAction(
  user: ReturnType<typeof userEvent.setup>,
  label: typeof PROMOTE | typeof DEMOTE
) {
  await openMenu(user);
  await user.click(await screen.findByRole("menuitem", { name: label }));
}

const LAST_ADMIN_BODY = {
  details: { organization_id: "org-1" },
  error: "last_organization_admin",
  message:
    "This user is the only admin of this organization. Grant another member the Admin role first.",
  status_code: 409,
};

const adminMembership = () => [
  createMockUserRole({ role: Role.Admin, organization_id: "org-1" }),
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  mockAuthStore.mockReturnValue({ isACoach: true, userSession: { id: "me" } });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MemberCard – role change action", () => {
  it("offers only Promote on a Member's row", async () => {
    const user = userEvent.setup();
    renderCard();

    await openMenu(user);

    expect(screen.getByRole("menuitem", { name: PROMOTE })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: DEMOTE })
    ).not.toBeInTheDocument();
  });

  it("offers only Demote on an Admin's row", async () => {
    const user = userEvent.setup();
    renderCard({ roles: adminMembership() });

    await openMenu(user);

    expect(screen.getByRole("menuitem", { name: DEMOTE })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: PROMOTE })
    ).not.toBeInTheDocument();
  });

  it("offers neither action on the viewer's own row", async () => {
    mockAuthStore.mockReturnValue({
      isACoach: true,
      userSession: { id: "user-1" },
    });
    const user = userEvent.setup();
    renderCard();

    const items = await openMenu(user);

    expect(items.length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("menuitem", { name: PROMOTE })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: DEMOTE })
    ).not.toBeInTheDocument();
  });

  it("hides the menu and both role actions from a plain member", () => {
    renderCard({ viewerRoleState: memberRole });

    expect(
      screen.queryByRole("button", { name: MENU_NAME })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(PROMOTE)).not.toBeInTheDocument();
    expect(screen.queryByText(DEMOTE)).not.toBeInTheDocument();
  });

  it("renders neither action for a global SuperAdmin with no membership here", async () => {
    const user = userEvent.setup();
    renderCard({
      roles: [
        createMockUserRole({ role: Role.SuperAdmin, organization_id: null }),
      ],
    });

    await openMenu(user);

    expect(
      screen.queryByRole("menuitem", { name: PROMOTE })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: DEMOTE })
    ).not.toBeInTheDocument();
  });

  it("promoting issues one PUT of Admin to the membership sub-route", async () => {
    const { bodies, urls } = captureRolePuts(() =>
      HttpResponse.json({ status_code: 200, data: null })
    );
    const user = userEvent.setup();
    renderCard();

    await chooseRoleAction(user, PROMOTE);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ role: "Admin" });
    expect(urls[0]).toBe("/organizations/org-1/users/user-1/role");
  });

  it("demoting issues one PUT of User", async () => {
    const { bodies } = captureRolePuts(() =>
      HttpResponse.json({ status_code: 200, data: null })
    );
    const user = userEvent.setup();
    renderCard({ roles: adminMembership() });

    await chooseRoleAction(user, DEMOTE);

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ role: "User" });
  });

  it("toasts the new role by name after a promotion", async () => {
    captureRolePuts(() => HttpResponse.json({ status_code: 200, data: null }));
    const user = userEvent.setup();
    renderCard();

    await chooseRoleAction(user, PROMOTE);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Ada Lovelace is now an Admin")
    );
  });

  it("toasts the new role by name after a demotion", async () => {
    captureRolePuts(() => HttpResponse.json({ status_code: 200, data: null }));
    const user = userEvent.setup();
    renderCard({ roles: adminMembership() });

    await chooseRoleAction(user, DEMOTE);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Ada Lovelace is now a Member")
    );
  });

  it("reports the last-admin 409 inline on the row, not as a toast", async () => {
    captureRolePuts(() => HttpResponse.json(LAST_ADMIN_BODY, { status: 409 }));
    const user = userEvent.setup();
    renderCard({ roles: adminMembership() });

    await chooseRoleAction(user, DEMOTE);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(LAST_ADMIN_BODY.message);
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("clears a stale refusal when the row's menu is reopened", async () => {
    // The last-admin refusal depends on OTHER members' roles, so it can stop
    // being true without anything on this row changing. Reopening the menu is
    // the point of retry, so the message must not still be sitting there.
    captureRolePuts(() => HttpResponse.json(LAST_ADMIN_BODY, { status: 409 }));
    const user = userEvent.setup();
    renderCard({ roles: adminMembership() });

    await chooseRoleAction(user, DEMOTE);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      LAST_ADMIN_BODY.message
    );

    await openMenu(user);
    // Close it again before asserting: while the menu is open Radix marks the
    // rest of the page aria-hidden, so an alert still in the DOM would drop out
    // of the a11y tree and the assertion would pass vacuously.
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("keys the inline branch off the slug, not the message prose", async () => {
    const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
    captureRolePuts(() =>
      HttpResponse.json({ ...LAST_ADMIN_BODY, message: lorem }, { status: 409 })
    );
    const user = userEvent.setup();
    renderCard({ roles: adminMembership() });

    await chooseRoleAction(user, DEMOTE);

    expect(await screen.findByRole("alert")).toHaveTextContent(lorem);
    expect(toast.error).not.toHaveBeenCalled();
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

    await chooseRoleAction(user, PROMOTE);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("This organization is archived.")
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports a bare-string 403 as a permission error", async () => {
    captureRolePuts(
      () => new HttpResponse("FORBIDDEN", { status: 403 }) as Response
    );
    const user = userEvent.setup();
    renderCard();

    await chooseRoleAction(user, PROMOTE);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(PERMISSION_DENIED_MESSAGE)
    );
  });

  it("clears the inline message once a later role change succeeds", async () => {
    let body: unknown = LAST_ADMIN_BODY;
    let status = 409;
    captureRolePuts(() => HttpResponse.json(body, { status }));
    const user = userEvent.setup();
    renderCard({ roles: adminMembership() });

    await chooseRoleAction(user, DEMOTE);
    await screen.findByRole("alert");

    body = { status_code: 200, data: null };
    status = 200;
    await chooseRoleAction(user, DEMOTE);

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    );
  });
});
