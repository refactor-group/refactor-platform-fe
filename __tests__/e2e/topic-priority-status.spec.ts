import { test, expect, type Page } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
} from './helpers'

// e2e coverage for the two CoachingSessionTopics v4 behaviors that are flaky or
// impossible to assert in jsdom: the real Radix Select priority interaction,
// and the carried-over provenance line that only renders inside the Radix
// HoverCard on hover. Strike-through + payload shapes are covered by unit tests.

const SESSION_ID = 'session-topics-1'
const REL_ID = 'rel-1'

const MOCK_SESSION = {
  id: SESSION_ID,
  coaching_relationship_id: REL_ID,
  date: '2026-03-24T16:30:00Z',
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
}

// The viewer (MOCK_USER_ID) must be the coachee for the priority control to be
// editable (priority is coachee-only).
const COACHEE_RELATIONSHIP = {
  id: REL_ID,
  coach_id: 'coach-1',
  coachee_id: MOCK_USER_ID,
  organization_id: 'org-1',
  coach_first_name: 'John',
  coach_last_name: 'Doe',
  coachee_first_name: 'Jane',
  coachee_last_name: 'Smith',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const makeTopic = (over: Record<string, unknown> = {}) => ({
  id: 'topic-1',
  coaching_session_id: SESSION_ID,
  user_id: MOCK_USER_ID,
  body: 'Discuss the roadmap',
  priority: null,
  status: 'Open',
  carried_from_topic_id: null,
  created_at: '2026-03-10T00:00:00Z',
  updated_at: '2026-03-10T00:00:00Z',
  ...over,
})

// Register topic routes AFTER mockCommonApiRoutes so they win (LIFO). Returns a
// list that captures every rating PATCH payload for assertion.
async function mockTopicRoutes(page: Page, topics: unknown[]) {
  const ratingPayloads: unknown[] = []

  await page.route('**/coaching_sessions/*/topics', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: topics }),
    })
  })

  await page.route('**/topics/*/rating', async (route) => {
    ratingPayloads.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: makeTopic({ priority: 'High' }) }),
    })
  })

  return { ratingPayloads }
}

test.describe('CoachingSessionTopics v4 — priority + carry-over (e2e)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Force the desktop layout so the inline Topics panel renders (mobile keeps
    // it in a closed sheet).
    await page.setViewportSize({ width: 1280, height: 800 })
    await setupAuthentication(page, context)
    // The panel only mounts when a current relationship id is set; that store
    // lives in sessionStorage and isn't covered by setupAuthentication.
    await page.addInitScript((relId) => {
      sessionStorage.setItem(
        'coaching-relationship-state-store',
        JSON.stringify({ state: { currentCoachingRelationshipId: relId }, version: 1 })
      )
    }, REL_ID)
    await mockCommonApiRoutes(page, {
      relationships: [COACHEE_RELATIONSHIP],
      coachingSessions: [MOCK_SESSION],
    })
    // The relationship *detail* fetch returns a single object (the array route
    // from mockCommonApiRoutes would otherwise win); the panel reads
    // coachee_id from it to decide priority is editable. Registered last → wins.
    await page.route('**/coaching_relationships/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: COACHEE_RELATIONSHIP }),
      })
    })
  })

  test('coachee sets a priority via the dropdown → PATCH carries the wire value', async ({
    page,
  }) => {
    const { ratingPayloads } = await mockTopicRoutes(page, [makeTopic()])

    await page.goto(`/coaching-sessions/${SESSION_ID}`)
    await expect(page.getByText('Discuss the roadmap')).toBeVisible()

    await page.getByRole('combobox', { name: 'Priority' }).click()
    await page.getByRole('option', { name: 'High' }).click()

    await expect.poll(() => ratingPayloads.length).toBeGreaterThan(0)
    expect(ratingPayloads[0]).toEqual({ priority: 'High' })
  })

  test('carried-over topic shows its provenance line on avatar hover', async ({
    page,
  }) => {
    test.skip(
      test.info().project.name.includes('Mobile'),
      'HoverCard opens on hover; touch projects have no hover'
    )

    await mockTopicRoutes(page, [
      makeTopic({
        id: 'topic-carried',
        body: 'Returning topic',
        carried_from_topic_id: 'prev-session-topic',
      }),
    ])

    await page.goto(`/coaching-sessions/${SESSION_ID}`)
    await expect(page.getByText('Returning topic')).toBeVisible()

    // The hovercard trigger wraps the small author avatar in the topic row.
    await page.locator('span.relative.inline-flex.shrink-0').first().hover()

    await expect(
      page.getByText('Carried over from a previous session')
    ).toBeVisible()
  })
})
