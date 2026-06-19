import { test, expect } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
  MOCK_ORGANIZATIONS,
  SINGLE_RELATIONSHIP,
} from './helpers'

// Regression guard for the coachee-actions visibility fix: a coach viewing
// /actions must still send `assignee=coach` for the default "My Actions"
// view and render the returned actions in the kanban.

const COACH_ID = SINGLE_RELATIONSHIP[0].coach_id
const SESSION_ID = 'session-1'
const RELATIONSHIP_ID = SINGLE_RELATIONSHIP[0].id

// Dates must be relative to "now": the board's default Last30Days filter drops
// actions whose due_by is older than 30 days, so hardcoded calendar dates rot
// the test ~30 days after they're written.
const isoDaysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
const RECENT = isoDaysFromNow(-1)
const DUE_SOON = isoDaysFromNow(1)

function mockAction(id: string, body: string, assigneeIds: string[]) {
  return {
    id,
    coaching_session_id: SESSION_ID,
    body,
    user_id: COACH_ID,
    status: 'NotStarted',
    status_changed_at: RECENT,
    due_by: DUE_SOON,
    created_at: RECENT,
    updated_at: RECENT,
    assignee_ids: assigneeIds,
  }
}

const COACH_ASSIGNED_ACTION = mockAction(
  'action-coach',
  'Coach-assigned action',
  [COACH_ID]
)

// addContextToAction drops actions whose coaching_session_id isn't in the
// session map AND whose enriched session lacks a relationship. Seed both.
const ENRICHED_SESSION = {
  id: SESSION_ID,
  coaching_relationship_id: RELATIONSHIP_ID,
  date: RECENT,
  created_at: RECENT,
  updated_at: RECENT,
  relationship: SINGLE_RELATIONSHIP[0],
}

test.describe('Coach viewing /actions (regression guard)', () => {
  test('sends batch request with assignee=coach for default "My Actions" view', async ({
    page,
    context,
  }) => {
    // Helper auth sets isACoach: true → Some(Coach) branch → assignee=coach.
    await setupAuthentication(page, context)
    await mockCommonApiRoutes(page)

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
                [MOCK_USER_ID]: [COACH_ASSIGNED_ACTION],
              },
            },
          }),
        })
      }
    )

    await page.goto('/actions')

    await expect(
      page.getByText(COACH_ASSIGNED_ACTION.body).first()
    ).toBeVisible({ timeout: 15_000 })

    // The default coach "My Actions" view sends assignee=coach. Sweep every
    // batch request — at least one should carry the param.
    expect(batchUrls.length).toBeGreaterThan(0)
    const anyCoachScope = batchUrls.some((url) => url.includes('assignee=coach'))
    expect(anyCoachScope).toBe(true)
  })
})
