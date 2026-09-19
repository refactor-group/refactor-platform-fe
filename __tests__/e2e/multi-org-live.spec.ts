import { test, expect, type Page } from "@playwright/test";

/**
 * Live end-to-end against the real backend and database, unlike the other e2e
 * specs in this directory which mock the API. Requires the backend on :4000 and
 * a seeded dev database.
 */

const PASSWORD = "password";
const SUPER_ADMIN = "admin@refactorcoach.com";
const EHAB = "ehab.bandar@gmail.com";
const REFACTOR_GROUP = "617e8b03-0c1c-49a6-b151-74e54e9e2de4";

async function login(page: Page, email: string) {
  await page.goto("/");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click('button:has-text("Sign In with Email")');
  await page.waitForURL(/dashboard/, { timeout: 20000 });
}

async function openAddMember(page: Page, organizationId: string) {
  await page.goto(`/organizations/${organizationId}/members`);
  await page.click('button:has-text("Add Member")');
  await expect(page.getByRole("heading", { name: "Add New Member" })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

// Not idempotent: it creates Ehab, BigTable and a session, so a second run fails
// on the duplicate email. Opt in with LIVE_E2E=1 against a freshly seeded database.
test.skip(
  !process.env.LIVE_E2E,
  "live end-to-end, set LIVE_E2E=1 with a freshly seeded database"
);

test("a: super admin adds Ehab to Refactor Group as a coachee", async ({ page }) => {
  await login(page, SUPER_ADMIN);
  await openAddMember(page, REFACTOR_GROUP);

  await page.fill("#firstName", "Ehab");
  await page.fill("#lastName", "Bandar");
  await page.fill("#displayName", "Ehab Bandar");
  await page.fill("#email", EHAB);

  // The new coach picker makes him a coachee in the same request. Exact match:
  // the org also has a "Jim Hodapp (Refactor Group)" member.
  await page.click("#coach");
  await page.getByRole("option", { name: "Jim Hodapp", exact: true }).click();

  await page.click('button:has-text("Create Member")');

  await expect(page.getByText("Ehab Bandar").first()).toBeVisible({ timeout: 15000 });
});

test("b: super admin creates the BigTable organization", async ({ page }) => {
  await login(page, SUPER_ADMIN);
  await page.goto("/admin/organizations");
  await page.click('button:has-text("Add organization")');
  await page.fill("#name", "BigTable");
  await page.click('button:has-text("Create organization")');

  await expect(page.getByText("BigTable").first()).toBeVisible({ timeout: 15000 });
});

test("c: super admin adds Ehab to BigTable as an existing member, role Admin", async ({
  page,
}) => {
  await login(page, SUPER_ADMIN);

  // Resolve BigTable's id from the API rather than guessing it.
  const orgs = await page.evaluate(async () => {
    const res = await fetch("http://localhost:4000/organizations", {
      headers: { "x-version": "1.0.0-beta1" },
      credentials: "include",
    });
    return (await res.json()).data as { id: string; name: string }[];
  });
  const bigTable = orgs.find((o) => o.name === "BigTable");
  expect(bigTable, "BigTable must exist from step b").toBeTruthy();

  await openAddMember(page, bigTable!.id);
  await page.getByRole("tab", { name: "Add existing member" }).click();
  await page.fill("#lookupEmail", EHAB);
  await page.click('button:has-text("Find")');

  await expect(page.getByText("Ehab Bandar")).toBeVisible({ timeout: 15000 });

  await page.click("#existingRole");
  await page.getByRole("option", { name: "Admin" }).click();
  await page.click('button:has-text("Add to organization")');

  await expect(page.getByText("Ehab Bandar").first()).toBeVisible({ timeout: 15000 });
});

test("d: Ehab, as BigTable admin, adds Jim to BigTable with himself as coach", async ({
  page,
}) => {
  await login(page, EHAB);

  const orgs = await page.evaluate(async () => {
    const res = await fetch("http://localhost:4000/organizations", {
      headers: { "x-version": "1.0.0-beta1" },
      credentials: "include",
    });
    return (await res.json()).data as { id: string; name: string }[];
  });
  const bigTable = orgs.find((o) => o.name === "BigTable");
  expect(bigTable, "Ehab must see BigTable, which he administers").toBeTruthy();

  await openAddMember(page, bigTable!.id);
  await page.getByRole("tab", { name: "Add existing member" }).click();
  await page.fill("#lookupEmail", "james.hodapp@gmail.com");
  await page.click('button:has-text("Find")');

  // Records what Ehab actually sees, which is the point of this step.
  const notFound = page.getByText("No user found with that email.");
  const found = page.getByText("Jim Hodapp");
  await expect(notFound.or(found).first()).toBeVisible({ timeout: 15000 });

  // FINDING: Ehab administers only BigTable, which is empty, and he is a plain
  // member (not admin) of Refactor Group. So he shares no administered org with
  // Jim and the lookup correctly hides him. A brand new organization is a
  // bootstrapping dead end for its own admin: nobody is in it yet, so there is
  // nobody they are allowed to add. Pinned so a future scope change is deliberate.
  await expect(notFound).toBeVisible();
});

test("d2: workaround, the super admin adds Jim to BigTable with Ehab as coach", async ({
  page,
}) => {
  await login(page, SUPER_ADMIN);

  const orgs = await page.evaluate(async () => {
    const res = await fetch("http://localhost:4000/organizations", {
      headers: { "x-version": "1.0.0-beta1" },
      credentials: "include",
    });
    return (await res.json()).data as { id: string; name: string }[];
  });
  const bigTable = orgs.find((o) => o.name === "BigTable")!;

  await openAddMember(page, bigTable.id);
  await page.getByRole("tab", { name: "Add existing member" }).click();
  await page.fill("#lookupEmail", "james.hodapp@gmail.com");
  await page.click('button:has-text("Find")');
  await expect(page.getByText("Jim Hodapp", { exact: true })).toBeVisible({ timeout: 15000 });

  await page.click("#coach");
  await page.getByRole("option", { name: "Ehab Bandar", exact: true }).click();
  await page.click('button:has-text("Add to organization")');

  await expect(page.getByText("Jim Hodapp").first()).toBeVisible({ timeout: 15000 });
});

test("e: Ehab schedules a BigTable coaching session with Jim", async ({ page }) => {
  await login(page, EHAB);

  // The dashboard opens on Refactor Group, where Ehab is only a coachee and so
  // has no Add New button. Switch to BigTable, where he is admin and Jim's coach.
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /BigTable/ }).click();
  await expect(page.getByRole("combobox").first()).toContainText("BigTable");

  await page.click('button:has-text("Add New")');
  await page.getByRole("menuitem", { name: /session/i }).click();

  await page.click("#coachee-select");
  await page.getByRole("option", { name: "Jim Hodapp", exact: true }).click();

  // Create Session stays disabled until a date and time are both chosen.
  await page.getByRole("button", { name: "Go to next month" }).click();
  await page.getByRole("gridcell", { name: "15", exact: true }).click();
  await page.fill("#session-time", "10:00");

  const submit = page.getByRole("button", { name: "Create Session" });
  await expect(submit).toBeEnabled({ timeout: 10000 });
  await submit.click();

  // Assert the session actually exists, not merely that the word "session" is on
  // screen: the dashboard already says "Coaching Sessions", which makes a loose
  // text assertion pass against a no-op.
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 20000 });

  const sessions = await page.evaluate(async () => {
    const orgRes = await fetch("http://localhost:4000/organizations", {
      headers: { "x-version": "1.0.0-beta1" },
      credentials: "include",
    });
    const orgs = (await orgRes.json()).data as { id: string; name: string }[];
    const bigTable = orgs.find((o) => o.name === "BigTable")!;
    const relRes = await fetch(
      `http://localhost:4000/organizations/${bigTable.id}/coaching_relationships`,
      { headers: { "x-version": "1.0.0-beta1" }, credentials: "include" }
    );
    const rels = (await relRes.json()).data as { id: string }[];
    const sesRes = await fetch(
      `http://localhost:4000/coaching_sessions?coaching_relationship_id=${rels[0].id}&from_date=2000-01-01&to_date=2100-01-01`,
      { headers: { "x-version": "1.0.0-beta1" }, credentials: "include" }
    );
    return (await sesRes.json()).data as unknown[];
  });

  expect(sessions.length, "a BigTable session must exist for Ehab and Jim").toBeGreaterThan(0);
});
