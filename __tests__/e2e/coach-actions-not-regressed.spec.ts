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

function mockAction(id: string, body: string, assigneeIds: string[]) {
  return {
    id,
    coaching_session_id: 'session-1',
    body,
    user_id: COACH_ID,
    status: 'NotStarted',
    status_changed_at: '2026-05-01T10:00:00Z',
    due_by: '2026-05-15T00:00:00Z',
    created_at: '2026-05-01T10:00:00Z',
    updated_at: '2026-05-01T10:00:00Z',
    assignee_ids: assigneeIds,
  }
}

const COACH_ASSIGNED_ACTION = mockAction(
  'action-coach',
  'Coach-assigned action',
  [COACH_ID]
)

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
