import { test, expect } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
  MOCK_ORGANIZATIONS,
  COLLEAGUE_VIEWER,
  mockRelationship,
} from './helpers'

// The Actions page toggle follows the viewer's roles: a coach who is also a
// colleague gets three views, and Colleagues' Actions asks for assignee=colleague.

const COACHING = mockRelationship('rel-coaching', { coach_id: MOCK_USER_ID })
const COLLEAGUE = mockRelationship(
  'rel-colleague',
  { coach_id: MOCK_USER_ID, coachee_id: 'peer-1', kind: 'colleague', viewer: COLLEAGUE_VIEWER },
  { coachee: { first_name: 'Cara', last_name: 'Peer', email: 'cara@example.com' } }
)

test.describe('Actions page views', () => {
  test('offers a coach and colleague three views, and scopes Colleagues\' Actions', async ({
    page,
    context,
  }) => {
    await setupAuthentication(page, context)
    await mockCommonApiRoutes(page, { relationships: [COACHING, COLLEAGUE] })

    await page.route('**/users/current/organizations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_ORGANIZATIONS }),
      })
    })

    const assignees: (string | null)[] = []
    await page.route('**/organizations/*/coaching_relationships/actions**', async (route) => {
      assignees.push(new URL(route.request().url()).searchParams.get('assignee'))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { actions_by_relationship: {} } }),
      })
    })

    await page.goto('/actions')

    const toggle = page.getByRole('radio')
    await expect(toggle).toHaveText(['My Actions', 'Coachee Actions', "Colleagues' Actions"], {
      timeout: 15_000,
    })

    await page.getByRole('radio', { name: "Colleagues' Actions" }).click()

    await expect(page).toHaveURL(/view=colleague_actions/)
    await expect.poll(() => assignees.at(-1)).toBe('colleague')
    expect(assignees).not.toContain('coachee')
  })
})
