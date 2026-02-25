import { test, expect } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
} from './helpers'

// ---------------------------------------------------------------------------
// Mock data — ISO strings, not DateTime objects (API response format)
// ---------------------------------------------------------------------------

/**
 * Enriched coaching session with relationship + user data.
 * addContextToAction needs: session.relationship, session.coach, session.coachee
 */
const ENRICHED_SESSION = {
  id: 'session-1',
  coaching_relationship_id: 'rel-1',
  date: '2026-02-20T10:00:00Z',
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
  relationship: {
    id: 'rel-1',
    coach_id: 'coach-1',
    coachee_id: MOCK_USER_ID,
    organization_id: 'org-1',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  },
  coach: {
    id: 'coach-1',
    email: 'coach@example.com',
    first_name: 'Alice',
    last_name: 'Smith',
    display_name: 'Alice Smith',
  },
  coachee: {
    id: MOCK_USER_ID,
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    display_name: 'Test User',
  },
  overarching_goal: {
    id: 'goal-1',
    title: 'Test Goal',
    coaching_session_id: 'session-1',
    body: '',
    status: 'NotStarted',
    status_changed_at: '2026-02-01T00:00:00Z',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  },
}

function mockAction(
  id: string,
  status: string,
  body: string
) {
  return {
    id,
    coaching_session_id: 'session-1',
    body,
    user_id: MOCK_USER_ID,
    status,
    status_changed_at: '2026-02-15T00:00:00Z',
    due_by: '2026-03-15T00:00:00Z',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    assignee_ids: [MOCK_USER_ID],
  }
}

const OPEN_ACTIONS = [
  mockAction('action-1', 'NotStarted', 'Write unit tests'),
  mockAction('action-2', 'NotStarted', 'Review PR feedback'),
  mockAction('action-3', 'InProgress', 'Update documentation'),
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up API mocks for the actions page */
async function setupActionsPage(
  ...args: Parameters<typeof mockCommonApiRoutes>
) {
  const [page, options] = args
  await mockCommonApiRoutes(page, options)

  // Enriched sessions endpoint (provides relationship/goal context for actions)
  await page.route(`**/users/${MOCK_USER_ID}/coaching_sessions**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [ENRICHED_SESSION] }),
    })
  })

  // User actions list endpoint
  await page.route(`**/users/${MOCK_USER_ID}/actions**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: OPEN_ACTIONS }),
    })
  })
}

/**
 * Intercept the PUT request when a status is changed and respond with success.
 * Returns a promise that resolves with the request body when the call is made.
 */
function interceptStatusUpdate(page: Parameters<typeof mockCommonApiRoutes>[0]) {
  return page.route('**/actions/action-*', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { ...body } }),
      })
    } else {
      await route.continue()
    }
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Actions page: exit animation and toast on status change', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
    await setupActionsPage(page)
    await interceptStatusUpdate(page)
  })

  test('card fades out and toast appears when changing status to a non-visible column', async ({
    page,
  }) => {
    // Navigate to actions page with Open filter (default)
    await page.goto('/actions')

    // Wait for the kanban board to render with the Not Started column
    await expect(
      page.getByRole('heading', { name: 'Not Started', level: 3 })
    ).toBeVisible({ timeout: 15_000 })

    // Verify the card is visible
    await expect(page.getByText('Write unit tests')).toBeVisible()

    // Open the status dropdown on the first card and select "Completed"
    // Each card has a StatusSelect rendered as a combobox
    const firstCard = page.locator('[data-kanban-card]').filter({ hasText: 'Write unit tests' })
    // Two StatusSelect comboboxes per card (mobile + desktop); desktop is last
    const statusTrigger = firstCard.locator('[role="combobox"]').last()
    await statusTrigger.click()
    await page.getByRole('option', { name: /Completed/ }).click()

    // After the animation completes (~300ms), a toast should appear
    await expect(page.getByText('Moved to Completed')).toBeVisible({
      timeout: 3_000,
    })

    // Toast should have Show and Undo buttons
    await expect(page.getByRole('button', { name: 'Show' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()

    // The card should no longer be in the visible columns
    await expect(page.getByText('Write unit tests')).toBeHidden()
  })

  test('toast Show button switches filter to All and reveals the card', async ({
    page,
  }) => {
    await page.goto('/actions')
    await expect(
      page.getByRole('heading', { name: 'Not Started', level: 3 })
    ).toBeVisible({ timeout: 15_000 })

    // Change a card's status to Completed
    const firstCard = page.locator('[data-kanban-card]').filter({ hasText: 'Write unit tests' })
    // Two StatusSelect comboboxes per card (mobile + desktop); desktop is last
    const statusTrigger = firstCard.locator('[role="combobox"]').last()
    await statusTrigger.click()
    await page.getByRole('option', { name: /Completed/ }).click()

    // Wait for toast
    await expect(page.getByText('Moved to Completed')).toBeVisible({
      timeout: 2_000,
    })

    // Click "Show" — should switch to All view showing all 4 columns
    await page.getByRole('button', { name: 'Show' }).click()

    // All 4 column headers should now be visible
    await expect(
      page.getByRole('heading', { name: 'Not Started', level: 3 })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'In Progress', level: 3 })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Completed', level: 3 })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: "Won't Do", level: 3 })
    ).toBeVisible()
  })

  test('toast Undo button restores the card to its original column', async ({
    page,
  }) => {
    await page.goto('/actions')
    await expect(
      page.getByRole('heading', { name: 'Not Started', level: 3 })
    ).toBeVisible({ timeout: 15_000 })

    // Verify initial count badge for Not Started
    const notStartedHeader = page
      .getByRole('heading', { name: 'Not Started', level: 3 })
      .locator('..')
    await expect(notStartedHeader.getByText('2')).toBeVisible()

    // Change a card's status to Completed
    const firstCard = page.locator('[data-kanban-card]').filter({ hasText: 'Write unit tests' })
    // Two StatusSelect comboboxes per card (mobile + desktop); desktop is last
    const statusTrigger = firstCard.locator('[role="combobox"]').last()
    await statusTrigger.click()
    await page.getByRole('option', { name: /Completed/ }).click()

    // Wait for toast, then click Undo
    await expect(page.getByText('Moved to Completed')).toBeVisible({
      timeout: 2_000,
    })
    await page.getByRole('button', { name: 'Undo' }).click()

    // The card should reappear in the Not Started column
    await expect(page.getByText('Write unit tests')).toBeVisible({
      timeout: 2_000,
    })

    // Count badge should be restored
    await expect(notStartedHeader.getByText('2')).toBeVisible()
  })

  test('card moves normally between visible columns without toast', async ({
    page,
  }) => {
    await page.goto('/actions')
    await expect(
      page.getByRole('heading', { name: 'Not Started', level: 3 })
    ).toBeVisible({ timeout: 15_000 })

    // Change a card from Not Started → In Progress (both visible in Open view)
    const firstCard = page.locator('[data-kanban-card]').filter({ hasText: 'Write unit tests' })
    // Two StatusSelect comboboxes per card (mobile + desktop); desktop is last
    const statusTrigger = firstCard.locator('[role="combobox"]').last()
    await statusTrigger.click()
    await page.getByRole('option', { name: /In Progress/ }).click()

    // Card should still be visible (moved to In Progress column)
    await expect(page.getByText('Write unit tests')).toBeVisible()

    // No exit animation should have been applied
    await expect(page.locator('.animate-kanban-card-exit')).toHaveCount(0)

    // No toast should appear — wait a moment to be sure
    await page.waitForTimeout(500)
    await expect(page.getByText(/Moved to/)).toBeHidden()
  })

  test('column count badge updates immediately when card starts exiting', async ({
    page,
  }) => {
    await page.goto('/actions')
    await expect(
      page.getByRole('heading', { name: 'Not Started', level: 3 })
    ).toBeVisible({ timeout: 15_000 })

    // Not Started starts with 2 actions
    const notStartedHeader = page
      .getByRole('heading', { name: 'Not Started', level: 3 })
      .locator('..')
    await expect(notStartedHeader.getByText('2')).toBeVisible()

    // Change a card to Completed
    const firstCard = page.locator('[data-kanban-card]').filter({ hasText: 'Write unit tests' })
    // Two StatusSelect comboboxes per card (mobile + desktop); desktop is last
    const statusTrigger = firstCard.locator('[role="combobox"]').last()
    await statusTrigger.click()
    await page.getByRole('option', { name: /Completed/ }).click()

    // Count should update to 1 immediately (before animation finishes)
    await expect(notStartedHeader.getByText('1')).toBeVisible({ timeout: 1_000 })
  })
})
