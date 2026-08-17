import { test, expect, type Page, type Locator } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
} from './helpers'

// e2e coverage for the inline member role Select: the real Radix Select
// interaction, the exact PUT payload it sends, the self-row lockout, and the
// last-admin 409 landing inline on the row instead of in a toast.

const ORG_ID = 'org-1'
const OTHER_MEMBER_ID = 'member-2'
const SELF_NAME = 'Test User'
const OTHER_NAME = 'Casey Coachee'

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

// The viewer is an org Admin so the Select renders at all; the second member is
// a plain Member so its trigger starts on "Member".
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
 * markup, so every assertion below is scoped through this rather than the page.
 */
function memberRow(page: Page, name: string): Locator {
  return page.locator('div.flex.items-center.p-4').filter({ hasText: name })
}

function roleSelect(page: Page, name: string): Locator {
  return memberRow(page, name).getByRole('combobox', { name: `Role for ${name}` })
}

test.describe('Organization members — inline role change (e2e)', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
    // setupAuthentication signs in a plain Member; the role Select only renders
    // for an org Admin, so overwrite the persisted store with an Admin session.
    await page.addInitScript((auth) => {
      localStorage.setItem('auth-store', auth)
    }, JSON.stringify(ADMIN_AUTH_STORE_STATE))
    await mockCommonApiRoutes(page, { relationships: [] })
  })

  test('changing another member to Admin PUTs {role: "Admin"} to that member', async ({
    page,
  }) => {
    const roleRequests = await mockMemberRoutes(page, {
      status: 200,
      body: { data: { ...OTHER_MEMBER, roles: [makeRole(OTHER_MEMBER_ID, 'Admin')] } },
    })

    await page.goto(`/organizations/${ORG_ID}/members`)
    await expect(roleSelect(page, OTHER_NAME)).toHaveText('Member')

    await roleSelect(page, OTHER_NAME).click()
    await page.getByRole('option', { name: 'Admin' }).click()

    await expect.poll(() => roleRequests.length).toBe(1)
    expect(roleRequests[0].body).toEqual({ role: 'Admin' })
    expect(roleRequests[0].url).toContain(
      `/organizations/${ORG_ID}/users/${OTHER_MEMBER_ID}/role`
    )
  })

  test('the signed-in admin cannot change their own role', async ({ page }) => {
    await mockMemberRoutes(page, { status: 200, body: { data: SELF_MEMBER } })

    await page.goto(`/organizations/${ORG_ID}/members`)

    await expect(roleSelect(page, SELF_NAME)).toBeDisabled()
    await expect(roleSelect(page, OTHER_NAME)).toBeEnabled()
  })

  test('a last_organization_admin 409 lands on the row and reverts the Select', async ({
    page,
  }) => {
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
    await expect(roleSelect(page, OTHER_NAME)).toHaveText('Member')

    await roleSelect(page, OTHER_NAME).click()
    await page.getByRole('option', { name: 'Admin' }).click()

    const row = memberRow(page, OTHER_NAME)
    await expect(row.getByRole('alert')).toHaveText(LAST_ADMIN_MESSAGE)
    await expect(roleSelect(page, OTHER_NAME)).toHaveText('Member')
  })
})
