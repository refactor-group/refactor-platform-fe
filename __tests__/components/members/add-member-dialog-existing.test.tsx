import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test-utils/msw-server";
import { AddMemberDialog } from "@/components/ui/members/add-member-dialog";
import { Role, type User, type UserRoleState } from "@/types/user";
import { toast } from "sonner";

// ── Module mocks ──────────────────────────────────────────────────────────────

// A concrete base URL so msw can match the real API calls this dialog makes.
vi.mock("@/site.config", () => ({
  siteConfig: {
    env: {
      backendServiceURL: "http://localhost:4000",
      backendApiVersion: "1.0.0-test",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));

vi.mock("@/lib/timezone-utils", () => ({
  getBrowserTimezone: () => "UTC",
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

const ADA = {
  id: "user-9",
  first_name: "Ada",
  last_name: "Lovelace",
  email: "ada@example.com",
};

/** Lookup handler that only answers for Ada's exact email. */
function lookupHandler(matches: typeof ADA | null) {
  return http.get("*/users", ({ request }) => {
    const email = new URL(request.url).searchParams.get("email");
    const found = matches && email === matches.email ? [matches] : [];
    return HttpResponse.json({ status_code: 200, data: found });
  });
}

/** Existing members offered as coach candidates. */
const GRACE = {
  id: "user-2",
  first_name: "Grace",
  last_name: "Hopper",
} as unknown as User;

function renderDialog(
  currentUserRoleState?: UserRoleState,
  organizationMembers?: User[]
) {
  render(
    <AddMemberDialog
      open
      onOpenChange={vi.fn()}
      onMemberAdded={vi.fn()}
      currentUserRoleState={currentUserRoleState}
      organizationMembers={organizationMembers}
    />
  );
}

/** Switches to the "Add existing member" tab, finds Ada, waits for the card. */
async function findAda(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("tab", { name: "Add existing member" }));
  await user.type(screen.getByLabelText("Email"), ADA.email);
  await user.click(screen.getByRole("button", { name: "Find" }));
  await screen.findByText("Ada Lovelace");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AddMemberDialog – add existing member gating", () => {
  it("does not offer the existing-member mode to a plain member", () => {
    renderDialog(memberRole);

    expect(
      screen.queryByRole("tab", { name: "Add existing member" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Member" })
    ).toBeInTheDocument();
  });

  it("offers the existing-member mode to an org admin, not only a super admin", () => {
    renderDialog(adminRole);

    expect(
      screen.getByRole("tab", { name: "Add existing member" })
    ).toBeInTheDocument();
  });
});

describe("AddMemberDialog – existing member lookup", () => {
  it("reports no match without hinting at visibility, and keeps the add button disabled", async () => {
    server.use(lookupHandler(null));
    const user = userEvent.setup();
    renderDialog(adminRole);

    await user.click(screen.getByRole("tab", { name: "Add existing member" }));
    await user.type(screen.getByLabelText("Email"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: "Find" }));

    expect(
      await screen.findByText("No user found with that email.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add to organization" })
    ).toBeDisabled();
  });

  it("shows the returned name and email on a match", async () => {
    server.use(lookupHandler(ADA));
    const user = userEvent.setup();
    renderDialog(adminRole);

    await findAda(user);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText(ADA.email)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add to organization" })
    ).toBeEnabled();
  });
});

describe("AddMemberDialog – pre-assigning a coach", () => {
  /** Captures relationship POSTs. `relationshipFails` makes them 500. */
  function captureRelationships(relationshipFails = false) {
    const calls: unknown[] = [];
    server.use(
      lookupHandler(ADA),
      http.post("*/organizations/:organizationId/users/:userId/role", () =>
        HttpResponse.json({ status_code: 200, data: { id: ADA.id } })
      ),
      http.post("*/organizations/:organizationId/users", () =>
        HttpResponse.json({ status_code: 201, data: { id: "user-new" } })
      ),
      http.post(
        "*/organizations/:organizationId/coaching_relationships",
        async ({ request }) => {
          calls.push(await request.json());
          return relationshipFails
            ? HttpResponse.json({ error: "boom" }, { status: 500 })
            : HttpResponse.json({ status_code: 201, data: { id: "rel-1" } });
        }
      )
    );
    return calls;
  }

  async function pickCoach(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByLabelText("Coach (optional)"));
    await user.click(await screen.findByRole("option", { name: "Grace Hopper" }));
  }

  it("assigns the chosen coach to a newly created member", async () => {
    const calls = captureRelationships();
    const user = userEvent.setup();
    renderDialog(adminRole, [GRACE]);

    await user.type(screen.getByLabelText("First Name"), "Ada");
    await user.type(screen.getByLabelText("Last Name"), "Lovelace");
    await user.type(screen.getByLabelText("Display Name"), "Ada");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await pickCoach(user);
    await user.click(screen.getByRole("button", { name: "Create Member" }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ coach_id: GRACE.id, coachee_id: "user-new" });
  });

  it("assigns the chosen coach to an attached existing member", async () => {
    const calls = captureRelationships();
    const user = userEvent.setup();
    renderDialog(adminRole, [GRACE]);

    await findAda(user);
    await pickCoach(user);
    await user.click(screen.getByRole("button", { name: "Add to organization" }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ coach_id: GRACE.id, coachee_id: ADA.id });
  });

  it("does not create a relationship when no coach is chosen", async () => {
    const calls = captureRelationships();
    const user = userEvent.setup();
    renderDialog(adminRole, [GRACE]);

    await findAda(user);
    await user.click(screen.getByRole("button", { name: "Add to organization" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(calls).toHaveLength(0);
  });

  /// The member is already added at this point, so the add must not read as failed.
  it("still reports the member as added when the coach assignment fails", async () => {
    captureRelationships(true);
    const user = userEvent.setup();
    renderDialog(adminRole, [GRACE]);

    await findAda(user);
    await pickCoach(user);
    await user.click(screen.getByRole("button", { name: "Add to organization" }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("Assign one from the member list")
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("keeps the found user off their own coach list", async () => {
    server.use(lookupHandler(ADA));
    const user = userEvent.setup();
    renderDialog(adminRole, [GRACE, ADA as unknown as User]);

    await findAda(user);
    await user.click(screen.getByLabelText("Coach (optional)"));

    expect(
      await screen.findByRole("option", { name: "Grace Hopper" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Ada Lovelace" })
    ).not.toBeInTheDocument();
  });
});

describe("AddMemberDialog – discarding a found user", () => {
  it("clears the found user when Clear is pressed", async () => {
    server.use(lookupHandler(ADA));
    const user = userEvent.setup();
    renderDialog(adminRole);

    await findAda(user);
    await user.click(screen.getByRole("button", { name: /^Clear / }));

    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add to organization" })
    ).toBeDisabled();
    expect(screen.getByLabelText("Email")).toHaveValue("");
  });

  /// Editing the email must invalidate the match it produced, or the add button
  /// acts on a stale selection while the field shows a different address.
  it("discards the found user when the email is edited after finding", async () => {
    server.use(lookupHandler(ADA));
    const user = userEvent.setup();
    renderDialog(adminRole);

    await findAda(user);
    await user.type(screen.getByLabelText("Email"), "x");

    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add to organization" })
    ).toBeDisabled();
  });
});

describe("AddMemberDialog – attaching an existing member", () => {
  /** Captures every POST to the membership sub-route. */
  function captureAttach() {
    const calls: { url: string; body: unknown }[] = [];
    server.use(
      lookupHandler(ADA),
      http.post(
        "*/organizations/:organizationId/users/:userId/role",
        async ({ request, params }) => {
          calls.push({ url: request.url, body: await request.json() });
          return HttpResponse.json({
            status_code: 200,
            data: { id: params.userId },
          });
        }
      )
    );
    return calls;
  }

  it("posts the selected role to the member's /role sub-route", async () => {
    const calls = captureAttach();
    const user = userEvent.setup();
    renderDialog(adminRole);

    await findAda(user);
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Admin" }));
    await user.click(screen.getByRole("button", { name: "Add to organization" }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe(
      `http://localhost:4000/organizations/org-1/users/${ADA.id}/role`
    );
    expect(calls[0].body).toEqual({ role: "Admin" });
  });

  it("defaults to the Member option, which submits the User role", async () => {
    const calls = captureAttach();
    const user = userEvent.setup();
    renderDialog(adminRole);

    await findAda(user);
    expect(screen.getByRole("combobox")).toHaveTextContent("Member");
    await user.click(screen.getByRole("button", { name: "Add to organization" }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({ role: "User" });
  });

  it("surfaces the already-a-member conflict rather than a generic error", async () => {
    server.use(
      lookupHandler(ADA),
      http.post("*/organizations/:organizationId/users/:userId/role", () =>
        HttpResponse.json(
          {
            error: "user_already_in_organization",
            message: "This user is already a member of this organization.",
          },
          { status: 409 }
        )
      )
    );
    const user = userEvent.setup();
    renderDialog(adminRole);

    await findAda(user);
    await user.click(screen.getByRole("button", { name: "Add to organization" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This user is already a member of this organization."
      )
    );
  });
});
