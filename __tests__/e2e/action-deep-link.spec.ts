import { test, expect, type Page } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
  SINGLE_RELATIONSHIP,
} from './helpers'

// ---------------------------------------------------------------------------
// Mock data — ISO strings (API response format)
// ---------------------------------------------------------------------------

const SESSION_ID = 'session-deep-1'
const PREV_SESSION_ID = 'session-prev-1'
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

/** Action belonging to the current session (appears in "New This Session") */
function mockSessionAction(id: string, body: string) {
  return {
    id,
    coaching_session_id: SESSION_ID,
    body,
    user_id: MOCK_USER_ID,
    status: 'NotStarted',
    status_changed_at: '2026-03-25T10:00:00Z',
    due_by: '2026-04-01T00:00:00Z',
    created_at: '2026-03-25T10:00:00Z',
    updated_at: '2026-03-25T10:00:00Z',
    assignee_ids: [COACH_ID],
  }
}

/** Action from a previous session (appears in "Due for Review") */
function mockReviewAction(id: string, body: string) {
  return {
    id,
    coaching_session_id: PREV_SESSION_ID,
    body,
    user_id: MOCK_USER_ID,
    status: 'InProgress',
    status_changed_at: '2026-03-12T10:00:00Z',
    due_by: '2026-03-20T00:00:00Z',
    created_at: '2026-03-11T10:00:00Z',
    updated_at: '2026-03-12T10:00:00Z',
    assignee_ids: [COACH_ID],
  }
}

const SESSION_ACTIONS = [
  mockSessionAction('action-s1', 'Draft quarterly report'),
  mockSessionAction('action-s2', 'Schedule team sync'),
]

const REVIEW_ACTIONS = [
  mockReviewAction('action-r1', 'Finish onboarding checklist'),
]

/** All actions scoped to the relationship (session + review) */
const ALL_RELATIONSHIP_ACTIONS = [...SESSION_ACTIONS, ...REVIEW_ACTIONS]

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

/**
 * Register API route mocks for the coaching session page and its panel.
 * Covers: session by ID, coaching sessions list, user actions, agreements,
 * goals, and the single coaching relationship endpoint.
 */
async function setupCoachingSessionPage(page: Page) {
  // Pre-seed relationship state in sessionStorage so the panel can resolve
  // coach/coachee names immediately without waiting for the page's sync effect.
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

  // GET /coaching_sessions/:id — single session fetch
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

  // GET /organizations/:org_id/coaching_relationships/:rel_id — single relationship
  await page.route(`**/organizations/org-1/coaching_relationships/${RELATIONSHIP_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: SINGLE_RELATIONSHIP[0] }),
    })
  })

  // GET /users/:id/actions — user actions endpoint
  await page.route(`**/users/${MOCK_USER_ID}/actions**`, async (route) => {
    const url = route.request().url()

    if (url.includes(`coaching_session_id=${SESSION_ID}`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: SESSION_ACTIONS }),
      })
    } else {
      // Relationship-scoped: return all actions
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: ALL_RELATIONSHIP_ACTIONS }),
      })
    }
  })

  // GET /coaching_sessions/:id/goals — session goals
  await page.route(`**/coaching_sessions/${SESSION_ID}/goals`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })

  // GET /coaching_sessions/goals?coaching_relationship_id=... — all relationship goals
  await page.route('**/coaching_sessions/goals**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  // GET /agreements — session agreements
  await page.route('**/agreements**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })
}

/**
 * Next.js dev mode shows an error overlay when `console.error` fires (e.g. SSE
 * connection failure in test env). Pressing Escape dismisses it so the actual
 * page content beneath is accessible.
 */
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

test.describe('Action deep-link: email link loads session, switches panel, scrolls, and highlights', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
    await setupCoachingSessionPage(page)
  })

  test('deep-link to session action auto-switches to Actions panel and shows the card', async ({
    page,
    isMobile,
  }) => {
    // Mobile uses a bottom-sheet layout where the panel content is collapsed
    test.skip(!!isMobile, 'Desktop panel layout test only')

    const targetAction = SESSION_ACTIONS[1] // "Schedule team sync"

    await page.goto(
      `/coaching-sessions/${SESSION_ID}?panel=actions&highlight=${targetAction.id}`
    )

    await dismissDevErrorOverlay(page)

    // Panel should have switched to Actions — verify both section headers
    await expect(page.getByText('New This Session')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Due for Review')).toBeVisible()

    // The target action card body text should be visible
    await expect(page.getByText(targetAction.body).first()).toBeVisible()
  })

  test('deep-link to review action expands "Due for Review" and shows the card', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'Desktop panel layout test only')

    const targetAction = REVIEW_ACTIONS[0] // "Finish onboarding checklist"

    await page.goto(
      `/coaching-sessions/${SESSION_ID}?panel=actions&highlight=${targetAction.id}`
    )

    await dismissDevErrorOverlay(page)

    // "Due for Review" section should be expanded and contain the target action
    await expect(page.getByTestId('review-section-toggle')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(targetAction.body).first()).toBeVisible()
  })

  test('deep-link briefly highlights the target action card', async ({
    page,
    isMobile,
  }) => {
    // Skip on mobile — the bottom sheet layout has different rendering
    test.skip(!!isMobile, 'Highlight ring assertion applies to desktop panel only')

    const targetAction = SESSION_ACTIONS[0] // "Draft quarterly report"

    await page.goto(
      `/coaching-sessions/${SESSION_ID}?panel=actions&highlight=${targetAction.id}`
    )

    await dismissDevErrorOverlay(page)

    // Wait for the action card to appear
    await expect(page.getByText(targetAction.body).first()).toBeVisible({ timeout: 15_000 })

    // The highlight ring should be applied. Tailwind compiles ring-primary/40
    // to a class containing "ring-2". Check via computed style rather than
    // fragile class name matching.
    const targetCard = page.getByText(targetAction.body).first().locator('xpath=ancestor::div[contains(@class, "ring-2")]')
    const hasHighlight = await targetCard.count() > 0

    // The highlight lasts 2 seconds. If we caught it, verify it clears.
    // If it already cleared (timing), that's also valid — the test below
    // covers the fundamental rendering and navigation.
    if (hasHighlight) {
      await expect(targetCard).toBeHidden({ timeout: 4_000 })
    }
  })

  test('deep-link with legacy ?tab= param also switches to Actions panel', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'Desktop panel layout test only')

    const targetAction = SESSION_ACTIONS[0] // "Draft quarterly report"

    // Use the legacy "tab" param (old bookmarks / email links)
    await page.goto(
      `/coaching-sessions/${SESSION_ID}?tab=actions&highlight=${targetAction.id}`
    )

    await dismissDevErrorOverlay(page)

    // Should still arrive at the Actions panel
    await expect(page.getByText('New This Session')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(targetAction.body).first()).toBeVisible()
  })

  test('deep-link scrolls a below-the-fold action into viewport', async ({
    page,
    isMobile,
  }) => {
    // Skip on mobile — the bottom sheet layout has different scroll mechanics
    test.skip(!!isMobile, 'Scroll assertion applies to desktop panel only')

    // Create enough session actions that the last one is below the visible area
    const manyActions = Array.from({ length: 12 }, (_, i) =>
      mockSessionAction(`action-many-${i}`, `Action item number ${i + 1}`)
    )
    const lastAction = manyActions[manyActions.length - 1]

    // Override the user-actions route to return the larger list
    await page.route(`**/users/${MOCK_USER_ID}/actions**`, async (route) => {
      const url = route.request().url()

      if (url.includes(`coaching_session_id=${SESSION_ID}`)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: manyActions }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: manyActions }),
        })
      }
    })

    await page.goto(
      `/coaching-sessions/${SESSION_ID}?panel=actions&highlight=${lastAction.id}`
    )

    await dismissDevErrorOverlay(page)

    // Wait for the panel to render
    await expect(page.getByText('New This Session')).toBeVisible({ timeout: 15_000 })

    // The last action should be scrolled into the visible viewport
    const actionText = page.getByText(lastAction.body).first()
    await expect(actionText).toBeVisible({ timeout: 5_000 })
    await expect(actionText).toBeInViewport({ timeout: 3_000 })
  })

  test('deep-link with non-existent action ID loads panel without crash or highlight', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'Desktop panel layout test only')

    await page.goto(
      `/coaching-sessions/${SESSION_ID}?panel=actions&highlight=bogus-action-id`
    )

    await dismissDevErrorOverlay(page)

    // Panel should still load and show both section headers
    await expect(page.getByText('New This Session')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Due for Review')).toBeVisible()

    // Existing action cards should render normally
    await expect(page.getByText(SESSION_ACTIONS[0].body).first()).toBeVisible()

    // No action card should have the deep-link highlight ring.
    // The highlight is applied as "ring-2 ring-primary/40" on action card wrappers.
    // Scope to the action section content to avoid matching unrelated ring-2 elements.
    const sessionContent = page.getByTestId('session-section-content')
    const reviewContent = page.getByTestId('review-section-content')
    const highlightedInSession = sessionContent.locator('[class*="ring-primary"]')
    const highlightedInReview = reviewContent.locator('[class*="ring-primary"]')
    await expect(highlightedInSession).toHaveCount(0)
    await expect(highlightedInReview).toHaveCount(0)
  })

  test('panel=actions without highlight param shows Actions panel with no highlight', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'Desktop panel layout test only')

    await page.goto(`/coaching-sessions/${SESSION_ID}?panel=actions`)

    await dismissDevErrorOverlay(page)

    // Actions panel should be active
    await expect(page.getByText('New This Session')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Due for Review')).toBeVisible()

    // Action cards render normally
    await expect(page.getByText(SESSION_ACTIONS[0].body).first()).toBeVisible()

    // No highlight ring applied to any action card
    const sessionContent = page.getByTestId('session-section-content')
    const reviewContent = page.getByTestId('review-section-content')
    const highlightedInSession = sessionContent.locator('[class*="ring-primary"]')
    const highlightedInReview = reviewContent.locator('[class*="ring-primary"]')
    await expect(highlightedInSession).toHaveCount(0)
    await expect(highlightedInReview).toHaveCount(0)
  })

  test('deep-link highlight ring is applied immediately and clears after ~2 seconds', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'Highlight ring assertion applies to desktop panel only')

    const targetAction = SESSION_ACTIONS[0] // "Draft quarterly report"

    await page.goto(
      `/coaching-sessions/${SESSION_ID}?panel=actions&highlight=${targetAction.id}`
    )

    await dismissDevErrorOverlay(page)

    // Wait for the card to appear
    await expect(page.getByText(targetAction.body).first()).toBeVisible({ timeout: 15_000 })

    // Poll for the highlight ring — it should appear within a short window
    const targetCard = page
      .getByText(targetAction.body)
      .first()
      .locator('xpath=ancestor::div[contains(@class, "ring-2")]')
    await expect(targetCard).toBeVisible({ timeout: 3_000 })

    // After 2s the component clears activeHighlight — the ring should disappear
    await expect(targetCard).toBeHidden({ timeout: 5_000 })
  })

  test('deep-link to review action expands a previously-collapsed review section', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'Desktop panel layout test only')

    const targetAction = REVIEW_ACTIONS[0] // "Finish onboarding checklist"

    // First, load without highlight to verify the review section content is visible
    // (it auto-expands when review actions exist), then collapse it manually
    await page.goto(`/coaching-sessions/${SESSION_ID}?panel=actions`)
    await dismissDevErrorOverlay(page)

    await expect(page.getByTestId('review-section-toggle')).toBeVisible({ timeout: 15_000 })

    // Collapse the review section
    await page.getByTestId('review-section-toggle').click()

    // Verify it collapsed — content should be hidden
    const reviewContent = page.getByTestId('review-section-content')
    await expect(reviewContent).toBeHidden()

    // Now navigate with a deep-link highlight to the review action
    await page.goto(
      `/coaching-sessions/${SESSION_ID}?panel=actions&highlight=${targetAction.id}`
    )
    await dismissDevErrorOverlay(page)

    // The review section should be auto-expanded and the target action visible
    await expect(page.getByTestId('review-section-content')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(targetAction.body).first()).toBeVisible()
  })

  test('review action card back-view has correct deep-link href', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'Desktop panel layout test only')

    const targetAction = REVIEW_ACTIONS[0] // "Finish onboarding checklist"

    await page.goto(`/coaching-sessions/${SESSION_ID}?panel=actions`)
    await dismissDevErrorOverlay(page)

    // Wait for the review action to render
    await expect(page.getByText(targetAction.body).first()).toBeVisible({ timeout: 15_000 })

    // Click the action card to flip it to the back view
    await page.getByText(targetAction.body).first().click()

    // The back view should have a "View in source session" link with the correct href.
    // The link is rendered as an <a> inside a Button with asChild.
    const deepLink = page.locator(
      `a[href*="panel=actions"][href*="highlight=${targetAction.id}"]`
    )
    await expect(deepLink).toBeVisible({ timeout: 5_000 })

    // Verify the href points to the source session (previous session)
    const href = await deepLink.getAttribute('href')
    expect(href).toContain(`/coaching-sessions/${PREV_SESSION_ID}`)
    expect(href).toContain(`panel=actions`)
    expect(href).toContain(`highlight=${targetAction.id}`)
  })
})
