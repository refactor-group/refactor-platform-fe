import { test, expect, type Page } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
} from './helpers'

// The member row's "Add relationship…" dialog: the real StepDialog flow, the
// exact POST it sends, and an existing coach shown but not pickable.

const ORG_ID = 'org-1'
const CARA_ID = 'member-cara'
const PAT_ID = 'member-pat'

const makeRole = (userId: string, role: 'Admin' | 'User') => ({
  id: `role-${userId}`,
  user_id: userId,
  role,
  organization_id: ORG_ID,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
})

const makeMember = (
  id: string,
  first: string,
  last: string,
  role: 'Admin' | 'User'
) => ({
  id,
  email: `${first.toLowerCase()}@example.com`,
  first_name: first,
  last_name: last,
  display_name: `${first} ${last}`,
  timezone: 'America/Chicago',
  roles: [makeRole(id, role)],
  invite_status: null,
})

const SELF = makeMember(MOCK_USER_ID, 'Test', 'User', 'Admin')
const CARA = makeMember(CARA_ID, 'Cara', 'Test', 'User')
const PAT = makeMember(PAT_ID, 'Pat', 'Coach', 'User')

const PAT_COACHES_CARA = {
  id: 'rel-1',
  organization_id: ORG_ID,
  coach_id: PAT_ID,
  coachee_id: CARA_ID,
  coach_first_name: 'Pat',
  coach_last_name: 'Coach',
  coachee_first_name: 'Cara',
  coachee_last_name: 'Test',
  kind: 'coaching',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const ADMIN_AUTH_STORE_STATE = {
  state: {
    userId: MOCK_USER_ID,
    userSession: SELF,
    isLoggedIn: true,
    isCurrentCoach: false,
    isACoach: true,
  },
  version: 2,
}

/** Registered after mockCommonApiRoutes so it wins (LIFO). Returns the observed POST bodies. */
async function mockMemberRoutes(
  page: Page,
  relationships: unknown[]
): Promise<unknown[]> {
  const posts: unknown[] = []
  await page.route('**/organizations/*/users', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [SELF, CARA, PAT] }),
    })
  )
  // A pathname match: the list call carries an `?organization_id=` query a glob would miss.
  await page.route(
    (url) =>
      url.pathname.endsWith(`/organizations/${ORG_ID}/coaching_relationships`),
    async (route) => {
      if (route.request().method() === 'POST') {
        posts.push(route.request().postDataJSON())
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status_code: 201, data: PAT_COACHES_CARA }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: relationships }),
      })
    }
  )
  return posts
}

async function openAddRelationship(page: Page, name: string): Promise<void> {
  await page.goto(`/organizations/${ORG_ID}/members`)
  await page
    .locator('div.flex.items-center.p-4')
    .filter({ hasText: name })
    .getByRole('button', { name: `Actions for ${name}` })
    .click()
  await page.getByRole('menuitem', { name: 'Add relationship…' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Add relationship' })
  ).toBeVisible()
}

test.describe('Members: add a relationship (e2e)', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
    await page.addInitScript((auth) => {
      localStorage.setItem('auth-store', auth)
    }, JSON.stringify(ADMIN_AUTH_STORE_STATE))
    await mockCommonApiRoutes(page, { relationships: [] })
  })

  test('adding a coach POSTs the pair with the coach first', async ({
    page,
  }) => {
    const posts = await mockMemberRoutes(page, [])
    await openAddRelationship(page, 'Cara Test')
    const dialog = page.getByRole('dialog', { name: 'Add relationship' })

    await dialog.getByRole('radio', { name: 'Coachee' }).click()
    await dialog.getByRole('button', { name: /^Next/ }).click()
    await dialog.getByRole('button', { name: /Pat Coach/ }).click()
    await expect(
      dialog.getByText('Pat Coach will coach Cara Test')
    ).toBeVisible()
    await dialog.getByRole('button', { name: 'Add relationship' }).click()

    await expect.poll(() => posts.length).toBe(1)
    expect(posts[0]).toEqual({ coach_id: PAT_ID, coachee_id: CARA_ID })
    await expect(
      page.getByText("Pat Coach is now Cara Test's coach")
    ).toBeVisible()
    await expect(dialog).toBeHidden()
  })

  test("someone who already coaches the member can't be picked as their coach", async ({
    page,
  }) => {
    await mockMemberRoutes(page, [PAT_COACHES_CARA])
    await openAddRelationship(page, 'Cara Test')
    const dialog = page.getByRole('dialog', { name: 'Add relationship' })

    await dialog.getByRole('radio', { name: 'Coachee' }).click()
    await dialog.getByRole('button', { name: /^Next/ }).click()
    const pat = dialog.getByRole('button', { name: /Pat Coach/ })
    await expect(pat).toBeDisabled()
    await expect(pat).toContainText("Already Cara's coach")
  })
})
