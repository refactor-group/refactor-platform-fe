import { test, expect, type Page } from "@playwright/test";

/**
 * Live end-to-end against the real backend and database, unlike the other e2e
 * specs in this directory which mock the API. Read-only, so unlike
 * multi-org-live.spec.ts it is repeatable: it creates nothing and asserts on
 * data an earlier run already seeded.
 *
 * Requires the backend on :4000, the frontend on :3000, and ehab.bandar@gmail.com
 * belonging to both Refactor Group and BigTable with his sessions in BigTable.
 */

const PASSWORD = "password";
const EHAB = "ehab.bandar@gmail.com";

/**
 * Browser time is pinned for every test in this file. The seeded BigTable
 * sessions sit at fixed instants (2026-08-07 and 2026-09-15), so which bucket
 * they land in, and whether either is still "upcoming", otherwise depends on the
 * day the suite happens to run. Both assertions below broke exactly that way
 * once the date rolled over.
 */
const PINNED_NOW = new Date("2026-08-06T15:00:00.000Z");

test.skip(
  !process.env.LIVE_E2E,
  "live end-to-end, set LIVE_E2E=1 with a seeded multi-org database"
);

async function login(page: Page, email: string) {
  await page.clock.setFixedTime(PINNED_NOW);
  await page.goto("/");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click('button:has-text("Sign In with Email")');
  await page.waitForURL(/dashboard/, { timeout: 20000 });
}

function switcher(page: Page) {
  return page.getByRole("combobox").first();
}

async function selectOrganization(page: Page, name: string) {
  await switcher(page).click();
  await page.getByRole("listbox").getByText(name, { exact: true }).click();
  await expect(switcher(page)).toContainText(name);
}

test("the switcher avatar shows the selected organization's initials, not a fixed RG", async ({
  page,
}) => {
  await login(page, EHAB);

  await selectOrganization(page, "Refactor Group");
  await expect(switcher(page)).toContainText("RG");

  await selectOrganization(page, "BigTable");
  // The regression: this stayed "RG" for every organization.
  await expect(switcher(page)).toContainText("BT");
  await expect(switcher(page)).not.toContainText("RG");
});

test("the dropdown gives each organization its own initials", async ({ page }) => {
  await login(page, EHAB);

  await switcher(page).click();
  const list = page.getByRole("listbox");
  await expect(list.getByText("RG", { exact: true })).toBeVisible();
  await expect(list.getByText("BT", { exact: true })).toBeVisible();
});

test("session requests carry the selected organization and refetch on switch", async ({
  page,
}) => {
  await login(page, EHAB);

  const sessionRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/coaching_sessions")) sessionRequests.push(url);
  });

  await selectOrganization(page, "Refactor Group");
  await expect
    .poll(() => sessionRequests.some((url) => url.includes("organization_id=")), {
      timeout: 15000,
    })
    .toBe(true);

  const beforeSwitch = sessionRequests.length;
  await selectOrganization(page, "BigTable");

  // Pins the SWR cache key. Without organization_id in it, switching would
  // serve the previous organization's cached list and issue nothing new.
  await expect
    .poll(() => sessionRequests.length, { timeout: 15000 })
    .toBeGreaterThan(beforeSwitch);

  const organizationIds = new Set(
    sessionRequests
      .map((url) => new URL(url).searchParams.get("organization_id"))
      .filter(Boolean)
  );
  expect(organizationIds.size, "both organizations must appear").toBe(2);
});

// Ehab's sessions all live in BigTable, so Refactor Group must render empty.
test("the Upcoming and Previous tabs are empty in the organization that has no sessions", async ({
  page,
}) => {
  await login(page, EHAB);

  // The week bucket's trigger carries a count and stays in the DOM whether or
  // not the accordion is expanded, unlike the session rows themselves. Its text
  // is title case in the DOM and uppercased only by CSS.
  const weekBucket = page.getByRole("button").filter({ hasText: /This Week ·/ });

  await selectOrganization(page, "Refactor Group");
  await expect(page.getByText(/No upcoming sessions scheduled for today/)).toBeVisible({
    timeout: 15000,
  });
  await expect(weekBucket).toHaveCount(0);

  await selectOrganization(page, "BigTable");
  await expect(weekBucket).toContainText("(1)", { timeout: 15000 });
});

test("the Upcoming Session card is empty in the organization that has no sessions", async ({
  page,
}) => {
  await login(page, EHAB);

  await selectOrganization(page, "Refactor Group");
  await expect(page.getByText("Session with Jim Hodapp")).toHaveCount(0, {
    timeout: 15000,
  });

  await selectOrganization(page, "BigTable");
  await expect(page.getByText("Session with Jim Hodapp").first()).toBeVisible({
    timeout: 15000,
  });
});

test("a cold dashboard load never requests sessions without an organization", async ({
  page,
}) => {
  const unscoped: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!url.includes("/coaching_sessions")) return;
    if (!new URL(url).searchParams.get("organization_id")) unscoped.push(url);
  });

  // Fresh context, so the organization is not known until /organizations returns.
  await login(page, EHAB);
  await expect(switcher(page)).toContainText(/Refactor Group|BigTable/);
  await expect(page.getByText(/Coaching Sessions/).first()).toBeVisible({
    timeout: 15000,
  });

  // Firing before the organization resolves returns every organization's
  // sessions, and they render before the scoped result replaces them.
  expect(
    unscoped.map((url) => new URL(url).pathname + new URL(url).search),
    "session requests must wait for the organization"
  ).toEqual([]);
});
