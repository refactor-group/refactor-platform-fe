import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import {
  AUTH_STORE_STATE,
  ORGANIZATION_STORE_STATE,
  MOCK_USER_ID,
  MOCK_ORGANIZATIONS,
  SINGLE_RELATIONSHIP,
  mockCommonApiRoutes,
} from './helpers'

// Canary: a coachee viewing /actions should send the batch request with NO
// `assignee` query param, and the kanban should render the actions returned
// by the backend's visibility predicate (self-assigned ∪ unassigned).
//
// Regression guard for: coachees sending assignee=coachee triggers strict-
// contains scope on the BE and silently drops unassigned actions.

const SESSION_ID = 'session-1'
const RELATIONSHIP_ID = SINGLE_RELATIONSHIP[0].id

function mockAction(id: string, body: string, assigneeIds: string[]) {
  return {
    id,
    coaching_session_id: SESSION_ID,
    body,
    user_id: MOCK_USER_ID,
    status: 'NotStarted',
    status_changed_at: '2026-05-01T10:00:00Z',
    due_by: '2026-05-15T00:00:00Z',
    created_at: '2026-05-01T10:00:00Z',
    updated_at: '2026-05-01T10:00:00Z',
    assignee_ids: assigneeIds,
  }
}

// addContextToAction drops actions whose coaching_session_id isn't in the
// session map AND whose enriched session lacks a relationship. Seed both.
const ENRICHED_SESSION = {
  id: SESSION_ID,
  coaching_relationship_id: RELATIONSHIP_ID,
  date: '2026-05-01T10:00:00Z',
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-01T10:00:00Z',
  relationship: SINGLE_RELATIONSHIP[0],
}

const SELF_ASSIGNED_ACTION = mockAction(
  'action-self',
  'Coachee self-assigned action',
  [MOCK_USER_ID]
)

const UNASSIGNED_ACTION = mockAction(
  'action-unassigned',
  'Up-for-grabs unassigned action',
  []
)

/**
 * Set up auth as a coachee (isACoach: false). Mirrors `setupAuthentication`
 * in helpers.ts but with the role flipped — we can't reuse the helper because
 * its AUTH_STORE_STATE has isACoach: true.
 */
async function setupAsCoachee(page: Page, context: BrowserContext) {
  const coacheeAuth = {
    ...AUTH_STORE_STATE,
    state: { ...AUTH_STORE_STATE.state, isACoach: false },
  }
  await page.addInitScript(
    ({ auth, org }) => {
      localStorage.setItem('auth-store', auth)
      localStorage.setItem('organization-state-store', org)
    },
    {
      auth: JSON.stringify(coacheeAuth),
      org: JSON.stringify(ORGANIZATION_STORE_STATE),
    }
  )
  await context.addCookies([
    {
      name: 'id',
      value: 'mock-session-id-123',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ])
}

test.describe('Coachee viewing /actions', () => {
  test('sends batch request with no `assignee` param and renders returned actions', async ({
    page,
    context,
  }) => {
    await setupAsCoachee(page, context)
    await mockCommonApiRoutes(page)

    // Override the catch-all to also serve the user's organization list
    await page.route('**/users/current/organizations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_ORGANIZATIONS }),
      })
    })

    // Seed the per-user enriched-sessions endpoint so the session map has
    // an entry for our action's coaching_session_id.
    await page.route(
      `**/users/${MOCK_USER_ID}/coaching_sessions**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [ENRICHED_SESSION] }),
        })
      }
    )

    // Capture every request to the batch endpoint so we can assert on the
    // query string after the page settles.
    const batchUrls: string[] = []
    await page.route(
      '**/organizations/*/coaching_relationships/actions**',
      async (route) => {
        batchUrls.push(route.request().url())
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              coachee_actions: {
                [MOCK_USER_ID]: [SELF_ASSIGNED_ACTION, UNASSIGNED_ACTION],
              },
            },
          }),
        })
      }
    )

    await page.goto('/actions')

    // Wait for at least one action body to be visible — proves the kanban
    // received and rendered data.
    await expect(
      page.getByText(SELF_ASSIGNED_ACTION.body).first()
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByText(UNASSIGNED_ACTION.body).first()
    ).toBeVisible()

    // Load-bearing assertion for the bug fix: no request to the batch endpoint
    // includes `assignee=` (coachee broad view omits scope so the backend's
    // visibility predicate handles narrowing).
    expect(batchUrls.length).toBeGreaterThan(0)
    for (const url of batchUrls) {
      expect(url).not.toContain('assignee=')
    }
  })
})
