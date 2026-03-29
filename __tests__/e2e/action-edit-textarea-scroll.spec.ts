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

const SESSION_ID = 'session-scroll-1'
const PREV_SESSION_ID = 'session-scroll-prev'
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

// Long body that overflows the textarea's max-h-[200px]
const LONG_ACTION_BODY = [
  'Line 1: Review the quarterly objectives and key results.',
  'Line 2: Identify blockers and escalation paths.',
  'Line 3: Draft the stakeholder communication plan.',
  'Line 4: Schedule follow-up with engineering leads.',
  'Line 5: Update the project timeline in Jira.',
  'Line 6: Prepare slides for the all-hands presentation.',
  'Line 7: Coordinate with design on the new mockups.',
  'Line 8: Review pull requests from the last sprint.',
  'Line 9: Write up the retrospective findings.',
  'Line 10: Plan the next iteration of the feature roadmap.',
].join('\n')

function mockAction(id: string, sessionId: string, body: string) {
  return {
    id,
    coaching_session_id: sessionId,
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

const SESSION_ACTIONS = [
  mockAction('action-scroll-1', SESSION_ID, LONG_ACTION_BODY),
]

const ALL_RELATIONSHIP_ACTIONS = [...SESSION_ACTIONS]

// Enriched session for the kanban /actions page
const ENRICHED_SESSION = {
  id: SESSION_ID,
  coaching_relationship_id: RELATIONSHIP_ID,
  date: '2026-03-25T10:00:00Z',
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
  relationship: {
    id: RELATIONSHIP_ID,
    coach_id: COACH_ID,
    coachee_id: `coachee-${RELATIONSHIP_ID}`,
    organization_id: 'org-1',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
  coach: {
    id: COACH_ID,
    email: 'coach@example.com',
    first_name: 'John',
    last_name: 'Doe',
    display_name: 'John Doe',
  },
  coachee: {
    id: `coachee-${RELATIONSHIP_ID}`,
    email: 'coachee@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    display_name: 'Jane Smith',
  },
  goals: [],
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

async function dismissDevErrorOverlay(page: Page) {
  const overlay = page.locator('nextjs-portal')
  if (await overlay.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
}

/** Set up mocks for the coaching session page (/coaching-sessions/:id) */
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

  await page.route(`**/coaching_sessions/${SESSION_ID}/goals`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })

  await page.route('**/coaching_sessions/goals**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
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

/** Set up mocks for the kanban actions page (/actions) */
async function setupActionsPage(page: Page) {
  await mockCommonApiRoutes(page)

  await page.route(`**/users/${MOCK_USER_ID}/coaching_sessions**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [ENRICHED_SESSION] }),
    })
  })

  await page.route(`**/users/${MOCK_USER_ID}/actions**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: SESSION_ACTIONS }),
    })
  })
}

// ---------------------------------------------------------------------------
// Shared test logic
// ---------------------------------------------------------------------------

/**
 * Flip the first action card to its back face, enter edit mode, then
 * verify the textarea scrolls internally without moving the page.
 */
async function assertTextareaScrollTrapped(page: Page) {
  // Flip card to back face
  const infoButton = page.getByRole('button', { name: 'Action options' }).first()
  await infoButton.waitFor({ state: 'visible', timeout: 15_000 })
  await infoButton.click()

  // Enter edit mode
  const editButton = page.getByRole('button', { name: 'Edit' })
  await editButton.waitFor({ state: 'visible', timeout: 5_000 })
  await editButton.click()

  // Wait for textarea to appear and have overflow
  const textarea = page.getByRole('textbox')
  await textarea.waitFor({ state: 'visible', timeout: 5_000 })
  await expect(textarea).toBeFocused()

  // Verify textarea has scrollable overflow
  const hasOverflow = await textarea.evaluate(
    (el: HTMLTextAreaElement) => el.scrollHeight > el.clientHeight
  )
  expect(hasOverflow).toBe(true)

  // Reset scroll positions
  await page.evaluate(() => { document.documentElement.scrollTop = 0 })
  await textarea.evaluate((el: HTMLTextAreaElement) => { el.scrollTop = 0 })

  // Get the textarea's bounding box and wheel-scroll over it
  const box = await textarea.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.wheel(0, 60)

  // Allow the scroll to settle
  await page.waitForTimeout(500)

  // Assert: textarea scrolled, page did not
  const result = await page.evaluate(() => {
    const ta = document.querySelector('textarea')
    return {
      pageScroll: document.documentElement.scrollTop,
      textareaScroll: ta ? ta.scrollTop : -1,
    }
  })

  expect(result.textareaScroll).toBeGreaterThan(0)
  expect(result.pageScroll).toBe(0)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Action edit textarea scroll trapping', () => {
  test.describe('Coaching session page', () => {
    test.beforeEach(async ({ page, context }) => {
      await setupAuthentication(page, context)
      await setupCoachingSessionPage(page)
    })

    test('textarea scrolls without moving the panel scroll container', async ({
      page,
      isMobile,
    }) => {
      test.skip(!!isMobile, 'flip card edit not available on mobile')

      await page.goto(`/coaching-sessions/${SESSION_ID}?panel=actions`)
      await dismissDevErrorOverlay(page)
      await assertTextareaScrollTrapped(page)
    })
  })

  test.describe('Actions kanban page', () => {
    test.beforeEach(async ({ page, context }) => {
      await setupAuthentication(page, context)
      await setupActionsPage(page)
    })

    test('textarea scrolls without moving the page', async ({
      page,
      isMobile,
    }) => {
      test.skip(!!isMobile, 'flip card edit not available on mobile')

      await page.goto('/actions')
      await dismissDevErrorOverlay(page)
      await assertTextareaScrollTrapped(page)
    })
  })
})
