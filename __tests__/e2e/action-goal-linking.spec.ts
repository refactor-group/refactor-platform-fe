import { test, expect, type Page } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
  SINGLE_RELATIONSHIP,
} from './helpers'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const SESSION_ID = 'session-goal-link-1'
const PREV_SESSION_ID = 'session-goal-link-prev'
const RELATIONSHIP_ID = SINGLE_RELATIONSHIP[0].id
const COACH_ID = SINGLE_RELATIONSHIP[0].coach_id

const MOCK_SESSION = {
  id: SESSION_ID,
  coaching_relationship_id: RELATIONSHIP_ID,
  date: '2026-03-25T10:00:00Z',
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
}

const PREVIOUS_SESSION = {
  id: PREV_SESSION_ID,
  coaching_relationship_id: RELATIONSHIP_ID,
  date: '2026-03-11T10:00:00Z',
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
}

const MOCK_GOALS = [
  {
    id: 'goal-1',
    coaching_relationship_id: RELATIONSHIP_ID,
    created_in_session_id: SESSION_ID,
    user_id: MOCK_USER_ID,
    title: 'Improve communication skills',
    body: 'Work on active listening and clear feedback',
    status: 'InProgress',
    status_changed_at: '2026-03-01T00:00:00Z',
    completed_at: '2026-03-01T00:00:00Z',
    target_date: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'goal-2',
    coaching_relationship_id: RELATIONSHIP_ID,
    created_in_session_id: SESSION_ID,
    user_id: MOCK_USER_ID,
    title: 'Build leadership skills',
    body: 'Practice delegation and team empowerment',
    status: 'InProgress',
    status_changed_at: '2026-03-01T00:00:00Z',
    completed_at: '2026-03-01T00:00:00Z',
    target_date: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
]

/** Session action linked to goal-1 */
const ACTION_WITH_GOAL = {
  id: 'action-linked-1',
  coaching_session_id: SESSION_ID,
  goal_id: 'goal-1',
  body: 'Practice active listening in next standup',
  user_id: MOCK_USER_ID,
  status: 'NotStarted',
  status_changed_at: '2026-03-25T10:00:00Z',
  due_by: '2026-04-01T00:00:00Z',
  created_at: '2026-03-25T10:00:00Z',
  updated_at: '2026-03-25T10:00:00Z',
  assignee_ids: [COACH_ID],
}

/** Session action without a goal link */
const ACTION_WITHOUT_GOAL = {
  id: 'action-no-goal-1',
  coaching_session_id: SESSION_ID,
  body: 'Review quarterly OKRs',
  user_id: MOCK_USER_ID,
  status: 'InProgress',
  status_changed_at: '2026-03-25T10:00:00Z',
  due_by: '2026-04-01T00:00:00Z',
  created_at: '2026-03-25T11:00:00Z',
  updated_at: '2026-03-25T11:00:00Z',
  assignee_ids: [COACH_ID],
}

/** Review action linked to goal-2 */
const REVIEW_ACTION_WITH_GOAL = {
  id: 'action-review-goal-1',
  coaching_session_id: PREV_SESSION_ID,
  goal_id: 'goal-2',
  body: 'Delegate weekly report to team lead',
  user_id: MOCK_USER_ID,
  status: 'InProgress',
  status_changed_at: '2026-03-12T10:00:00Z',
  due_by: '2026-03-20T00:00:00Z',
  created_at: '2026-03-11T10:00:00Z',
  updated_at: '2026-03-12T10:00:00Z',
  assignee_ids: [COACH_ID],
}

const SESSION_ACTIONS = [ACTION_WITH_GOAL, ACTION_WITHOUT_GOAL]
const ALL_RELATIONSHIP_ACTIONS = [...SESSION_ACTIONS, REVIEW_ACTION_WITH_GOAL]

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

async function setupCoachingSessionPage(page: Page) {
  const relStateJson = JSON.stringify({
    state: { currentCoachingRelationshipId: RELATIONSHIP_ID },
    version: 1,
  })
  await page.addInitScript(
    (json) => sessionStorage.setItem('coaching-relationship-state-store', json),
    relStateJson
  )

  await mockCommonApiRoutes(page, {
    coachingSessions: [MOCK_SESSION, PREVIOUS_SESSION],
  })

  await page.route(`**/coaching_sessions/${SESSION_ID}`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_SESSION }),
      })
    } else {
      await route.continue()
    }
  })

  await page.route(`**/organizations/org-1/coaching_relationships/${RELATIONSHIP_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: SINGLE_RELATIONSHIP[0] }),
    })
  })

  await page.route(`**/users/${MOCK_USER_ID}/actions**`, async (route) => {
    const url = route.request().url()

    if (url.includes(`coaching_session_id=${SESSION_ID}`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: SESSION_ACTIONS }),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: ALL_RELATIONSHIP_ACTIONS }),
      })
    }
  })

  // Session goals — return linked goals
  await page.route(`**/coaching_sessions/${SESSION_ID}/goals`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_GOALS }),
    })
  })

  // Relationship goals
  await page.route('**/coaching_sessions/goals**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_GOALS }),
    })
  })

  // Goal progress
  await page.route('**/goals/*/progress', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          actions_completed: 0,
          actions_total: 1,
          linked_session_count: 1,
          progress: 'NeedsAttention',
          last_session_date: null,
          next_action_due: null,
        },
      }),
    })
  })

  await page.route('**/agreements**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })
}

async function dismissDevErrorOverlay(page: Page) {
  const overlay = page.locator('nextjs-portal')
  if (await overlay.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Action goal linking: goal pill display and goal picker', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
    await setupCoachingSessionPage(page)
  })

  test('session action with goal_id shows goal pill on front face', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'Desktop panel layout test only')

    await page.goto(`/coaching-sessions/${SESSION_ID}?panel=actions`)
    await dismissDevErrorOverlay(page)

    await expect(page.getByText('New This Session')).toBeVisible({ timeout: 15_000 })

    // The goal-linked action should show a goal pill with the goal title
    const goalPill = page.getByTestId('goal-pill').first()
    await expect(goalPill).toBeVisible()
    await expect(goalPill).toContainText('Improve communication')
  })

  test('session action without goal_id does not show goal pill', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'Desktop panel layout test only')

    await page.goto(`/coaching-sessions/${SESSION_ID}?panel=actions`)
    await dismissDevErrorOverlay(page)

    await expect(page.getByText('New This Session')).toBeVisible({ timeout: 15_000 })

    // The action without goal should be visible but without a goal pill
    await expect(page.getByText('Review quarterly OKRs').first()).toBeVisible()

    // There should be exactly 1 goal pill (from the linked action), not 2
    const goalPills = page.getByTestId('goal-pill')
    // Count within session section — 1 for linked action, 0 for unlinked
    // Plus 1 in review section for the review action with goal
    await expect(goalPills).toHaveCount(2)
  })

  test('review action with goal_id shows goal pill in Due for Review section', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'Desktop panel layout test only')

    await page.goto(`/coaching-sessions/${SESSION_ID}?panel=actions`)
    await dismissDevErrorOverlay(page)

    await expect(page.getByText('Due for Review')).toBeVisible({ timeout: 15_000 })

    // The review action body should be visible
    await expect(page.getByText('Delegate weekly report to team lead').first()).toBeVisible()

    // The review section should contain a goal pill for "Build leadership skills"
    const reviewSection = page.getByTestId('review-section-content')
    const reviewGoalPill = reviewSection.getByTestId('goal-pill')
    await expect(reviewGoalPill).toBeVisible()
    await expect(reviewGoalPill).toContainText('Build leadership')
  })

  test('goal picker appears in action edit form', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'Desktop panel layout test only')

    await page.goto(`/coaching-sessions/${SESSION_ID}?panel=actions`)
    await dismissDevErrorOverlay(page)

    await expect(page.getByText('New This Session')).toBeVisible({ timeout: 15_000 })

    // Flip to back face of the unlinked action
    const actionCard = page.getByText('Review quarterly OKRs').first()
    await expect(actionCard).toBeVisible()

    // Find the info/flip button on the same card and click it
    const flipButton = page.locator('button[aria-label="Action options"]').nth(1)
    await flipButton.click()

    // Click Edit to enter edit mode
    await page.getByText('Edit').click()

    // The Goal label and "None" button should appear in the edit form
    await expect(page.getByText('Goal')).toBeVisible()
    await expect(page.getByText('None')).toBeVisible()
  })
})
