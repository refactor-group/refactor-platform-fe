import { test, expect, type Page } from "@playwright/test";

/**
 * Live end-to-end for the add-existing-member tab gate, against the real backend
 * and the seeded local users.
 *
 * Read-only for the @single-org cases. The @multi-org cases require an operator
 * to have promoted ehab to Admin of Refactor Group first (he already admins
 * BigTable), which the runner script does around them.
 */

const PASSWORD = "password";
const ORG = {
  refactorGroup: "617e8b03-0c1c-49a6-b151-74e54e9e2de4",
  bigTable: "9c5cd245-cf67-432c-b78c-2f567cae99f2",
  acme: "f67343c9-6c15-4878-a171-be321fdaf34b",
};

test.skip(
  !process.env.LIVE_E2E,
  "live end-to-end, set LIVE_E2E=1 with the seeded local database"
);
test.describe.configure({ mode: "serial" });

async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button:has-text("Sign In with Email")');
  await page.waitForURL(/dashboard/, { timeout: 20000 });
}

async function openMembers(page: Page, organizationId: string) {
  await page.goto(`/organizations/${organizationId}/members`);
  await page.click('button:has-text("Add Member")');
  await expect(page.getByRole("heading", { name: "Add New Member" })).toBeVisible();
}

const existingTab = (page: Page) =>
  page.getByRole("tab", { name: "Add existing member" });

// ── Tab hidden: admins of exactly one organization ───────────────────────────

test("@single-org jim, admin of Refactor Group only, sees no existing-member tab", async ({
  page,
}) => {
  await login(page, "jim@refactorgroup.com");
  await openMembers(page, ORG.refactorGroup);

  await expect(existingTab(page)).toHaveCount(0);
  // The create form is still fully available.
  await expect(page.getByLabel("First Name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Member" })).toBeVisible();
});

test("@single-org ehab, admin of BigTable only, sees no existing-member tab", async ({
  page,
}) => {
  await login(page, "ehab.bandar@gmail.com");
  await openMembers(page, ORG.bigTable);

  await expect(existingTab(page)).toHaveCount(0);
});

test("@single-org caleb, admin of Acme only, sees no existing-member tab", async ({
  page,
}) => {
  await login(page, "calebbourg2@gmail.com");
  await openMembers(page, ORG.acme);

  await expect(existingTab(page)).toHaveCount(0);
});

test("@single-org a plain member cannot reach the members page at all", async ({
  page,
}) => {
  await login(page, "james.hodapp@gmail.com");
  await page.goto(`/organizations/${ORG.refactorGroup}/members`);

  // Access control denies the page outright, so there is no dialog to gate.
  await expect(page.getByRole("button", { name: "Add Member" })).toHaveCount(0);
});

// ── Tab shown: super admin ───────────────────────────────────────────────────

test("@single-org the super admin sees the existing-member tab", async ({ page }) => {
  await login(page, "admin@refactorcoach.com");
  await openMembers(page, ORG.refactorGroup);

  await expect(existingTab(page)).toBeVisible();
});

// ── Lookup outcomes, exercised as the super admin ────────────────────────────

test("@single-org an unknown email reports no user found", async ({ page }) => {
  await login(page, "admin@refactorcoach.com");
  await openMembers(page, ORG.refactorGroup);
  await existingTab(page).click();

  await page.fill("#lookupEmail", "nobody.here@nowhere.test");
  await page.click('button:has-text("Find")');

  await expect(page.getByText("No user found with that email.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to organization" })
  ).toBeDisabled();
});

test("@single-org an existing member is rejected at lookup, not on submit", async ({
  page,
}) => {
  await login(page, "admin@refactorcoach.com");
  await openMembers(page, ORG.refactorGroup);
  await existingTab(page).click();

  // james is already a member of Refactor Group.
  await page.fill("#lookupEmail", "james.hodapp@gmail.com");
  await page.click('button:has-text("Find")');

  await expect(
    page.getByText("This user is already a member of this organization.")
  ).toBeVisible();
  // Scoped to the dialog: his member card is on the page behind it.
  await expect(
    page.getByRole("dialog").getByText("Jim Hodapp", { exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add to organization" })
  ).toBeDisabled();
});

test("@single-org a findable non-member shows a card that Clear discards", async ({
  page,
}) => {
  await login(page, "admin@refactorcoach.com");
  await openMembers(page, ORG.bigTable);
  await existingTab(page).click();

  // caleb is in Acme and Refactor Group, not BigTable.
  await page.fill("#lookupEmail", "calebbourg2@gmail.com");
  await page.click('button:has-text("Find")');

  await expect(page.getByText("Caleb Bourg")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to organization" })
  ).toBeEnabled();

  await page.getByRole("button", { name: /^Clear/ }).click();
  await expect(page.getByText("Caleb Bourg")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add to organization" })
  ).toBeDisabled();
});

// ── Multi-org admin: the driving use case ────────────────────────────────────

test("@multi-org ehab, now admin of two organizations, sees the tab", async ({
  page,
}) => {
  await login(page, "ehab.bandar@gmail.com");
  await openMembers(page, ORG.bigTable);

  await expect(existingTab(page)).toBeVisible();
});

test("@multi-org ehab adds a Refactor Group member into BigTable", async ({
  page,
}) => {
  await login(page, "ehab.bandar@gmail.com");
  await openMembers(page, ORG.bigTable);
  await existingTab(page).click();

  // caleb is a Refactor Group member, and ehab now administers Refactor Group,
  // so caleb is visible to him and is not yet in BigTable.
  await page.fill("#lookupEmail", "calebbourg2@gmail.com");
  await page.click('button:has-text("Find")');
  await expect(page.getByText("Caleb Bourg")).toBeVisible();

  await page.click('button:has-text("Add to organization")');

  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 20000 });
  await expect(page.getByText("Caleb Bourg").first()).toBeVisible({
    timeout: 15000,
  });
});
