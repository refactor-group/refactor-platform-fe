import { test, expect, type Page } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
  SINGLE_RELATIONSHIP,
} from './helpers'

// ---------------------------------------------------------------------------
// Lean E2E for the "Add as …" notes-selection feature.
//
// The prefill itself originates in the TipTap collab notes editor, which is not
// reachable under mocked routes (it needs a live collab JWT + websocket and a
// 10s offline-editing fallback). That seam is covered by unit/integration
// tests and verified manually. This spec covers the part that IS reachable in
// the real browser: for each panel section, the add-flow the selection drives
// opens its add-form, and (for agreements) Save persists via the create POST.
// ---------------------------------------------------------------------------

const SESSION_ID = 'session-add-from-notes'
const RELATIONSHIP_ID = SINGLE_RELATIONSHIP[0].id

// Make the signed-in user the coach so the panel is editable (the add-flows
// are hidden when readOnly), and date the session in the future so it isn't
// treated as a past, read-only session.
const MOCK_RELATIONSHIP = { ...SINGLE_RELATIONSHIP[0], coach_id: MOCK_USER_ID }

const MOCK_SESSION = {
  id: SESSION_ID,
  coaching_relationship_id: RELATIONSHIP_ID,
  date: '2027-03-25T10:00:00Z',
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
}

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
    relationships: [MOCK_RELATIONSHIP],
    coachingSessions: [MOCK_SESSION],
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

  await page.route(
    `**/organizations/org-1/coaching_relationships/${RELATIONSHIP_ID}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_RELATIONSHIP }),
      })
    }
  )

  await page.route(`**/users/${MOCK_USER_ID}/actions**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
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

test.describe('Add from notes selection: panel add-flows', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
    await setupCoachingSessionPage(page)
  })

  test('Actions section opens an add-form with a body editor', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'Desktop panel layout test only')

    await page.route('**/agreements**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      })
    })

    await page.goto(`/coaching-sessions/${SESSION_ID}?panel=actions`)
    await dismissDevErrorOverlay(page)

    await expect(page.getByTestId('action-tab-new')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: /^add$/i }).first().click()

    // The new-action card mounts in edit mode with a body editor.
    const sessionContent = page.getByTestId('session-section-content')
    await expect(sessionContent.getByRole('textbox').first()).toBeVisible()
  })

  test('Goals section reaches the create-goal form with a title field', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'Desktop panel layout test only')

    await page.route('**/agreements**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      })
    })

    await page.goto(`/coaching-sessions/${SESSION_ID}?panel=goals`)
    await dismissDevErrorOverlay(page)

    // Add → browse view → Create new → the create form (title-first).
    await page.getByRole('button', { name: /^add$/i }).first().click()
    await page.getByRole('button', { name: /create new/i }).first().click()

    await expect(
      page.getByPlaceholder(/what do you want to achieve/i)
    ).toBeVisible({ timeout: 15_000 })
  })

  test('Agreements section opens an add-form and Save persists via the create POST', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'Desktop panel layout test only')

    let createdBody: string | null = null
    await page.route('**/agreements**', async (route) => {
      const req = route.request()
      if (req.method() === 'POST') {
        const payload = req.postDataJSON() as { body?: string }
        createdBody = payload?.body ?? null
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'agreement-new',
              coaching_session_id: SESSION_ID,
              body: createdBody,
              created_at: '2026-03-25T10:00:00Z',
              updated_at: '2026-03-25T10:00:00Z',
            },
          }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      }
    })

    await page.goto(`/coaching-sessions/${SESSION_ID}?panel=agreements`)
    await dismissDevErrorOverlay(page)

    await page.getByRole('button', { name: /^add$/i }).first().click()

    const editor = page.getByRole('textbox').first()
    await expect(editor).toBeVisible({ timeout: 15_000 })
    await editor.fill('Weekly retro every Friday')

    await page.getByRole('button', { name: /^save$/i }).first().click()

    await expect.poll(() => createdBody).toBe('Weekly retro every Friday')
  })
})
