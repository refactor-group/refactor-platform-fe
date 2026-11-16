import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test-utils/msw-server";
import { AddMemberDialog } from "@/components/ui/members/add-member-dialog";
import { AddMemberMode } from "@/lib/add-member-dialog-model";
import { USER_LOOKUP_RATE_LIMITED_MESSAGE } from "@/lib/api/users";
import { toast } from "@/lib/toast";
import type { User } from "@/types/user";

// A concrete base URL so msw can match the real API calls this dialog makes.
vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:4000", backendApiVersion: "1.0.0-test" } },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1", currentOrganization: { name: "Acme" } }),
}));
vi.mock("@/lib/timezone-utils", () => ({ getBrowserTimezone: () => "UTC" }));

const ADA = { id: "user-9", first_name: "Ada", last_name: "Lovelace", email: "ada@example.com" };
const GRACE = { id: "user-2", first_name: "Grace", last_name: "Hopper", email: "grace@example.com" } as User;

/** Lookup handler that only answers for Ada's exact email. */
function lookupHandler(matches: typeof ADA | null) {
  return http.get("*/users", ({ request }) => {
    const email = new URL(request.url).searchParams.get("email");
    return HttpResponse.json({ status_code: 200, data: matches && email === matches.email ? [matches] : [] });
  });
}

/** Captures create and attach bodies, plus any relationship POST, which would mean a second call came back. */
function captureAdds(fail?: { status: number; body: unknown }) {
  const created: unknown[] = [];
  const attached: { url: string; body: unknown }[] = [];
  const relationships: unknown[] = [];
  const reply = (ok: unknown) => (fail ? HttpResponse.json(fail.body, { status: fail.status }) : HttpResponse.json(ok));
  server.use(
    lookupHandler(ADA),
    http.post("*/organizations/:organizationId/users/:userId/role", async ({ request }) => {
      attached.push({ url: request.url, body: await request.json() });
      return reply({ status_code: 200, data: { id: ADA.id } });
    }),
    http.post("*/organizations/:organizationId/users", async ({ request }) => {
      created.push(await request.json());
      return reply({ status_code: 201, data: { id: "user-new" } });
    }),
    http.post("*/organizations/:organizationId/coaching_relationships", async ({ request }) => {
      relationships.push(await request.json());
      return HttpResponse.json({ status_code: 201, data: { id: "rel-1" } });
    })
  );
  return { created, attached, relationships };
}

function renderDialog({
  canAddExisting = true,
  members = [GRACE],
  initialMode = AddMemberMode.Create,
}: { canAddExisting?: boolean; members?: User[]; initialMode?: AddMemberMode } = {}) {
  const onClose = vi.fn();
  const onMemberAdded = vi.fn();
  render(
    <AddMemberDialog
      onClose={onClose}
      onMemberAdded={onMemberAdded}
      organizationMembers={members}
      canAddExisting={canAddExisting}
      initialMode={initialMode}
    />
  );
  return { onClose, onMemberAdded };
}

type Clicker = ReturnType<typeof userEvent.setup>;

const addButton = () => screen.getByRole("button", { name: "Add member" });
const next = (user: Clicker) => user.click(screen.getByRole("button", { name: "Next" }));

async function fillNewPerson(user: Clicker) {
  await user.type(screen.getByLabelText("First name"), "Ada");
  await user.type(screen.getByLabelText("Last name"), "Lovelace");
  await user.type(screen.getByLabelText("Display name"), "Ada");
  await user.type(screen.getByLabelText("Email"), "new@example.com");
}

async function findAda(user: Clicker) {
  await user.click(screen.getByRole("button", { name: "Has an account" }));
  await user.type(screen.getByLabelText("Email"), ADA.email);
  await user.click(screen.getByRole("button", { name: "Find" }));
  await screen.findByText("Ada Lovelace", { selector: "p" });
}

async function pickGrace(user: Clicker) {
  await user.click(screen.getByRole("radio", { name: "Coachee" }));
  await next(user);
  await user.click(screen.getByRole("button", { name: /Grace Hopper/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  // The phone layout, whose footer has a labelled Next button.
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("AddMemberDialog – modes", () => {
  it("offers only a new person when existing accounts can't be added", () => {
    renderDialog({ canAddExisting: false });
    expect(screen.queryByRole("button", { name: "Has an account" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
  });

  it("starts on a new person by default", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "New person" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens on an existing account when asked, as Add back links do", () => {
    renderDialog({ initialMode: AddMemberMode.Existing });
    expect(screen.getByRole("button", { name: "Has an account" })).toHaveAttribute("aria-pressed", "true");
  });

  it("ignores an existing-account request it can't honour", () => {
    renderDialog({ canAddExisting: false, initialMode: AddMemberMode.Existing });
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
  });
});

describe("AddMemberDialog – creating a member", () => {
  it("can't move on until the details are filled in", async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.getByText("Fill in their details")).toBeInTheDocument();
    await fillNewPerson(user);
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("sends the chosen coach in the create request, not a second one", async () => {
    const { created, relationships } = captureAdds();
    const user = userEvent.setup();
    const { onClose, onMemberAdded } = renderDialog();

    await fillNewPerson(user);
    await next(user);
    await pickGrace(user);
    expect(screen.getByText("Ada Lovelace to Acme as a member, coached by Grace Hopper")).toBeInTheDocument();
    await user.click(addButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(created[0]).toMatchObject({
      first_name: "Ada",
      email: "new@example.com",
      timezone: "UTC",
      relationship: { with_user_id: GRACE.id, kind: "coaching" },
    });
    expect(created[0]).not.toHaveProperty("coach_id");
    expect(relationships).toHaveLength(0);
    expect(onMemberAdded).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Ada Lovelace added");
  });

  it("makes the new member a colleague in the same request", async () => {
    const { created } = captureAdds();
    const user = userEvent.setup();
    renderDialog();

    await fillNewPerson(user);
    await next(user);
    await user.click(screen.getByRole("radio", { name: "Colleague" }));
    await next(user);
    expect(screen.getByRole("heading", { name: "Choose Ada's colleague" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Grace Hopper/ }));
    await user.click(addButton());

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({ relationship: { with_user_id: GRACE.id, kind: "colleague" } });
  });

  it("omits the relationship entirely when none is chosen", async () => {
    const { created } = captureAdds();
    const user = userEvent.setup();
    renderDialog();

    await fillNewPerson(user);
    await next(user);
    await user.click(addButton());

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).not.toHaveProperty("relationship");
  });

  it("confirms on the first step when there's nobody to pair with", async () => {
    const { created } = captureAdds();
    const user = userEvent.setup();
    renderDialog({ members: [] });

    await fillNewPerson(user);
    await user.click(addButton());

    await waitFor(() => expect(created).toHaveLength(1));
  });

  it.each([
    [
      "our archived copy, not the backend message, when the org is archived",
      { status: 409, body: { error: "organization_archived", message: "This organization is archived and cannot accept new changes." } },
      "This organization is archived · It can't be changed",
    ],
    ["the permission-denied message on a 403", { status: 403, body: { error: "forbidden" } }, "You don't have permission to do that"],
    ["the generic message for other errors", { status: 500, body: { error: "boom" } }, "Couldn't add the member"],
  ])("shows %s, and stays open", async (_name, fail, message) => {
    captureAdds(fail);
    const user = userEvent.setup();
    const { onClose } = renderDialog({ members: [] });

    await fillNewPerson(user);
    await user.click(addButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(toast.success).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("AddMemberDialog – existing account lookup", () => {
  it("reports no match without hinting at visibility, and can't move on", async () => {
    server.use(lookupHandler(null));
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Has an account" }));
    await user.type(screen.getByLabelText("Email"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: "Find" }));

    expect(await screen.findByText("No user found with that email.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.getByText("Find their account first")).toBeInTheDocument();
  });

  it("blames the searcher, not the address, when the lookup is throttled", async () => {
    // UserLookupEndpoint v2: the throttle is the only 429 this endpoint sends.
    server.use(
      http.get("*/users", () =>
        HttpResponse.json(
          {
            error: "user_lookup_rate_limited",
            message: "Too many user lookups. Please wait before trying again.",
            status_code: 429,
          },
          { status: 429 }
        )
      )
    );
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Has an account" }));
    await user.type(screen.getByLabelText("Email"), ADA.email);
    await user.click(screen.getByRole("button", { name: "Find" }));

    expect(await screen.findByText(USER_LOOKUP_RATE_LIMITED_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText("There was an error looking up that email.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Too many user lookups/)).not.toBeInTheDocument();
  });

  it("shows the returned name and email on a match", async () => {
    server.use(lookupHandler(ADA));
    const user = userEvent.setup();
    renderDialog();

    await findAda(user);

    expect(screen.getAllByText(ADA.email).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("reports an existing member at lookup time instead of on submit", async () => {
    server.use(lookupHandler(ADA));
    const user = userEvent.setup();
    renderDialog({ members: [GRACE, { id: ADA.id, first_name: "Ada", last_name: "Lovelace" } as User] });

    await user.click(screen.getByRole("button", { name: "Has an account" }));
    await user.type(screen.getByLabelText("Email"), ADA.email);
    await user.click(screen.getByRole("button", { name: "Find" }));

    await screen.findByText("They're already a member of this organization");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("clears the found user when Clear is pressed", async () => {
    server.use(lookupHandler(ADA));
    const user = userEvent.setup();
    renderDialog();

    await findAda(user);
    await user.click(screen.getByRole("button", { name: /^Clear / }));

    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("");
  });

  /// Editing the email must invalidate the match it produced, or Add acts on a
  /// stale selection while the field shows a different address.
  it("discards the found user when the email is edited after finding", async () => {
    server.use(lookupHandler(ADA));
    const user = userEvent.setup();
    renderDialog();

    await findAda(user);
    await user.type(screen.getByLabelText("Email"), "x");

    expect(screen.queryByRole("button", { name: /^Clear / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("discards a lookup that lands after the email was edited", async () => {
    // The reply is held open so the email can be edited while it is in flight.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get("*/users", async ({ request }) => {
        const email = new URL(request.url).searchParams.get("email");
        if (email === ADA.email) await held;
        return HttpResponse.json({ status_code: 200, data: email === ADA.email ? [ADA] : [] });
      })
    );
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Has an account" }));
    await user.type(screen.getByLabelText("Email"), ADA.email);
    await user.click(screen.getByRole("button", { name: "Find" }));
    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "someone.else@example.com");
    release();

    await waitFor(() => expect(screen.getByRole("button", { name: "Find" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: /^Clear / })).not.toBeInTheDocument();
  });
});

describe("AddMemberDialog – attaching an existing account", () => {
  it("posts the chosen access to the member's /role sub-route", async () => {
    const { attached } = captureAdds();
    const user = userEvent.setup();
    renderDialog();

    await findAda(user);
    await next(user);
    expect(screen.getByRole("heading", { name: "Ada's access to Acme" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Admin" }));
    await next(user);
    await user.click(addButton());

    await waitFor(() => expect(attached).toHaveLength(1));
    expect(attached[0].url).toBe(`http://localhost:4000/organizations/org-1/users/${ADA.id}/role`);
    expect(attached[0].body).toEqual({ role: "Admin" });
    expect(toast.success).toHaveBeenCalledWith("Ada Lovelace added to this organization");
  });

  it("defaults to Member, which submits the User role", async () => {
    const { attached } = captureAdds();
    const user = userEvent.setup();
    renderDialog();

    await findAda(user);
    await next(user);
    expect(screen.getByRole("radio", { name: "Member" })).toBeChecked();
    await next(user);
    await user.click(addButton());

    await waitFor(() => expect(attached).toHaveLength(1));
    expect(attached[0].body).toEqual({ role: "User" });
  });

  it("sends the chosen coach in the attach request, not a second one", async () => {
    const { attached, relationships } = captureAdds();
    const user = userEvent.setup();
    renderDialog();

    await findAda(user);
    await next(user);
    await next(user);
    await pickGrace(user);
    await user.click(addButton());

    await waitFor(() => expect(attached).toHaveLength(1));
    expect(attached[0].body).toEqual({ role: "User", relationship: { with_user_id: GRACE.id, kind: "coaching" } });
    expect(relationships).toHaveLength(0);
  });

  it("names the pair when they already have a relationship", async () => {
    captureAdds({ status: 409, body: { error: "conflict", details: { reason: "pair_already_related", relationship_id: "rel-9" } } });
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await findAda(user);
    await next(user);
    await next(user);
    await pickGrace(user);
    await user.click(addButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Ada Lovelace and Grace Hopper already have a relationship"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("surfaces the already-a-member conflict rather than a generic error", async () => {
    captureAdds({
      status: 409,
      body: { error: "user_already_in_organization", message: "This user is already a member of this organization." },
    });
    const user = userEvent.setup();
    renderDialog();

    await findAda(user);
    await next(user);
    await next(user);
    await user.click(addButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("They're already a member of this organization"));
  });
});
