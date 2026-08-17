import { test, expect, type Page, type Locator } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
} from './helpers'

// e2e coverage for the member role change in the row's ⋯ menu: the real Radix
// menu interaction, the exact PUT payload it sends, the self-row omission, and
// the last-admin 409 landing inline on the row instead of in a toast.

const ORG_ID = 'org-1'
const OTHER_MEMBER_ID = 'member-2'
const SELF_NAME = 'Test User'
const OTHER_NAME = 'Casey Coachee'

const PROMOTE = 'Promote to Admin'
const DEMOTE = 'Demote to Member'

const LAST_ADMIN_MESSAGE =
  'This user is the only admin of this organization. Grant another member the Admin role first.'

const makeRole = (userId: string, role: 'Admin' | 'User') => ({
  id: `role-${userId}`,
  user_id: userId,
  role,
  organization_id: ORG_ID,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
})

// The viewer is an org Admin so the role action renders at all; the second
// member is a plain Member so their row offers "Promote to Admin".
const SELF_MEMBER = {
  id: MOCK_USER_ID,
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  display_name: SELF_NAME,
  timezone: 'America/Chicago',
  roles: [makeRole(MOCK_USER_ID, 'Admin')],
  invite_status: null,
}

const OTHER_MEMBER = {
  id: OTHER_MEMBER_ID,
  email: 'casey@example.com',
  first_name: 'Casey',
  last_name: 'Coachee',
  display_name: OTHER_NAME,
  timezone: 'America/Chicago',
  roles: [makeRole(OTHER_MEMBER_ID, 'User')],
  invite_status: null,
}

const ADMIN_AUTH_STORE_STATE = {
  state: {
    userId: MOCK_USER_ID,
    userSession: SELF_MEMBER,
    isLoggedIn: true,
    isCurrentCoach: false,
    isACoach: true,
  },
  version: 2,
}

interface RoleRequest {
  url: string
  body: unknown
}

/**
 * Registered after mockCommonApiRoutes so it wins (LIFO). Returns the list of
 * observed role PUTs. `putResponse` decides what the backend "returns".
 */
async function mockMemberRoutes(
  page: Page,
  putResponse: { status: number; body: unknown }
): Promise<RoleRequest[]> {
  const roleRequests: RoleRequest[] = []

  await page.route('**/organizations/*/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [SELF_MEMBER, OTHER_MEMBER] }),
    })
  })

  await page.route('**/organizations/*/users/*/role', async (route) => {
    const request = route.request()
    if (request.method() !== 'PUT') {
      await route.fulfill({ status: 204, body: '' })
      return
    }
    roleRequests.push({ url: request.url(), body: request.postDataJSON() })
    await route.fulfill({
      status: putResponse.status,
      contentType: 'application/json',
      body: JSON.stringify(putResponse.body),
    })
  })

  return roleRequests
}

/**
 * The member row that owns `name`. Member rows repeat and share their inner
 * markup, so every row assertion below is scoped through this rather than the
 * page. The menu content itself is portalled outside the row.
 */
function memberRow(page: Page, name: string): Locator {
  return page.locator('div.flex.items-center.p-4').filter({ hasText: name })
}

async function openRowMenu(page: Page, name: string): Promise<void> {
  await memberRow(page, name)
    .getByRole('button', { name: `Actions for ${name}` })
    .click()
  await expect(page.getByRole('menu')).toBeVisible()
}

test.describe('Organization members — role change from the row menu (e2e)', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
    // setupAuthentication signs in a plain Member; the role action only renders
    // for an org Admin, so overwrite the persisted store with an Admin session.
    await page.addInitScript((auth) => {
      localStorage.setItem('auth-store', auth)
    }, JSON.stringify(ADMIN_AUTH_STORE_STATE))
    await mockCommonApiRoutes(page, { relationships: [] })
  })

  test('promoting another member PUTs {role: "Admin"} to that member', async ({
    page,
  }) => {
    const roleRequests = await mockMemberRoutes(page, {
      status: 200,
      body: { data: { ...OTHER_MEMBER, roles: [makeRole(OTHER_MEMBER_ID, 'Admin')] } },
    })

    await page.goto(`/organizations/${ORG_ID}/members`)
    await openRowMenu(page, OTHER_NAME)
    await page.getByRole('menuitem', { name: PROMOTE }).click()

    await expect.poll(() => roleRequests.length).toBe(1)
    expect(roleRequests[0].body).toEqual({ role: 'Admin' })
    expect(roleRequests[0].url).toContain(
      `/organizations/${ORG_ID}/users/${OTHER_MEMBER_ID}/role`
    )
    await expect(page.getByText(`${OTHER_NAME} is now an Admin`)).toBeVisible()
  })

  test('the signed-in admin is offered no role action on their own row', async ({
    page,
  }) => {
    await mockMemberRoutes(page, { status: 200, body: { data: SELF_MEMBER } })

    await page.goto(`/organizations/${ORG_ID}/members`)
    await openRowMenu(page, SELF_NAME)

    await expect(page.getByRole('menuitem', { name: PROMOTE })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: DEMOTE })).toHaveCount(0)
  })

  test('a last_organization_admin 409 lands on the row', async ({ page }) => {
    await mockMemberRoutes(page, {
      status: 409,
      body: {
        status_code: 409,
        error: 'last_organization_admin',
        message: LAST_ADMIN_MESSAGE,
        details: { organization_id: ORG_ID },
      },
    })

    await page.goto(`/organizations/${ORG_ID}/members`)
    await openRowMenu(page, OTHER_NAME)
    await page.getByRole('menuitem', { name: PROMOTE }).click()

    await expect(memberRow(page, OTHER_NAME).getByRole('alert')).toHaveText(
      LAST_ADMIN_MESSAGE
    )
  })
})
