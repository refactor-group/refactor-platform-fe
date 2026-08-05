import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test-utils/msw-server";
import { AddMemberDialog } from "@/components/ui/members/add-member-dialog";
import { Role, type UserRoleState } from "@/types/user";
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
  toast: { error: vi.fn(), success: vi.fn() },
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

function renderDialog(currentUserRoleState?: UserRoleState) {
  render(
    <AddMemberDialog
      open
      onOpenChange={vi.fn()}
      onMemberAdded={vi.fn()}
      currentUserRoleState={currentUserRoleState}
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
