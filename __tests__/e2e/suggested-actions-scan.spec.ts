import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
  SINGLE_RELATIONSHIP,
} from './helpers'

// The Actions panel's rescan button against a stateful mocked scan route.

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' })

const SESSION_ID = 'session-scan-1'
const DESKTOP = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }
const NAME = 'Scan transcript for suggested actions'
const SCAN_PATH = `/coaching_sessions/${SESSION_ID}/transcript_suggestions/scan`

const TIPS = {
  failed: 'Scan failed. Scan transcript again',
  completed: 'Transcript already scanned for actions',
}

const BASE_RELATIONSHIP = SINGLE_RELATIONSHIP[0]
type Relationship = typeof BASE_RELATIONSHIP
const AS_COACH: Relationship = { ...BASE_RELATIONSHIP, coach_id: MOCK_USER_ID }
const AS_COACHEE: Relationship = { ...BASE_RELATIONSHIP, coachee_id: MOCK_USER_ID }

const sessionOn = (date: string) => ({
  id: SESSION_ID,
  coaching_relationship_id: BASE_RELATIONSHIP.id,
  date,
  created_at: '2026-01-01T12:00:00Z',
  updated_at: '2026-01-01T12:00:00Z',
})

// Far enough ahead that the session never ends while the suite runs.
const UPCOMING = sessionOn('2099-01-05T12:00:00Z')
// Long past, so the after-session lock applies.
const ENDED = sessionOn('2025-01-06T12:00:00Z')

type Status = 'unavailable' | 'none' | 'pending' | 'processing' | 'completed' | 'failed'

interface ScanBackend {
  status: Status
  posts: string[]
}

const json = (data: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ status_code: status, data }),
})

async function mockBackend(
  page: Page,
  relationship: Relationship,
  session: ReturnType<typeof sessionOn>,
  status: Status
): Promise<ScanBackend> {
  const backend: ScanBackend = { status, posts: [] }

  await page.addInitScript((relId) => {
    sessionStorage.setItem(
      'coaching-relationship-state-store',
      JSON.stringify({ state: { currentCoachingRelationshipId: relId }, version: 1 })
    )
  }, relationship.id)
  await mockCommonApiRoutes(page, {
    relationships: [relationship],
    coachingSessions: [session],
  })
  // Registered after the common routes so these win.
  await page.route('**/coaching_relationships/*', (route) => route.fulfill(json(relationship)))
  // The single-session read decides the after-session lock.
  await page.route(`**/coaching_sessions/${SESSION_ID}`, (route) => route.fulfill(json(session)))
  await page.route('**/coaching_sessions/*/transcript_suggestions**', (route) =>
    route.fulfill(json([]))
  )
  await page.route('**/coaching_sessions/*/transcript_suggestions/scan**', (route) => {
    const request = route.request()
    if (request.method() === 'GET') return route.fulfill(json({ status: backend.status }))

    const url = new URL(request.url())
    backend.posts.push(`${url.pathname}${url.search}`)
    if (backend.status === 'failed' || backend.status === 'none') {
      backend.status = 'pending'
      return route.fulfill(json({ status: 'pending' }, 202))
    }
    const message =
      backend.status === 'completed'
        ? 'Suggested actions were already made for this transcript.'
        : 'A scan is already running.'
    return route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'conflict', message }),
    })
  })
  return backend
}

async function openActionsPanel(page: Page): Promise<Locator> {
  await page.goto(`/coaching-sessions/${SESSION_ID}`)
  const panel = page.locator('div.hidden.md\\:block')
  // The coachee's Topics section adds a Priority combobox after the section picker.
  await panel.getByRole('combobox').first().click()
  await page.getByRole('option', { name: /Actions/ }).click()
  await expect(panel.getByRole('combobox').first()).toContainText('Actions')
  return panel
}

// Opens the panel sheet and switches it to Actions as a user would.
async function openActionsSheet(page: Page): Promise<Locator> {
  await page.goto(`/coaching-sessions/${SESSION_ID}`)
  await page.locator('div.md\\:hidden').getByRole('button').first().click()
  // The Radix popover is also a dialog; the sheet is the one with the panel.
  const sheet = page.getByRole('dialog').filter({ has: page.getByRole('combobox') })
  await sheet.getByRole('combobox').click()
  await page.getByRole('option', { name: /Actions/ }).click()
  return sheet
}

test.describe('Rescanning a transcript from the Actions panel', () => {
  test.use({ viewport: DESKTOP })

  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
  })

  test('is hidden when a scan is not possible', async ({ page }) => {
    await mockBackend(page, AS_COACH, UPCOMING, 'unavailable')
    const panel = await openActionsPanel(page)

    await expect(panel.getByRole('button', { name: 'Add' })).toBeVisible()
    await expect(panel.getByRole('button', { name: NAME })).toHaveCount(0)
  })

  test('retries a failed scan once and then shows it running', async ({ page }) => {
    const backend = await mockBackend(page, AS_COACH, UPCOMING, 'failed')
    const panel = await openActionsPanel(page)
    const button = panel.getByRole('button', { name: NAME })

    await expect(button).toBeVisible()
    await expect(button).not.toHaveAttribute('aria-disabled', 'true')
    await button.hover()
    await expect(page.getByRole('tooltip')).toHaveText(TIPS.failed)

    await button.click()
    await expect(button).toHaveAttribute('aria-disabled', 'true')
    await expect(button.locator('svg')).toHaveClass(/animate-spin/)
    expect(backend.posts).toEqual([`${SCAN_PATH}?target=action`])
  })

  test('does not rescan a completed transcript, and says why', async ({ page }) => {
    const backend = await mockBackend(page, AS_COACH, UPCOMING, 'completed')
    const panel = await openActionsPanel(page)
    const button = panel.getByRole('button', { name: NAME })

    await expect(button).toHaveAttribute('aria-disabled', 'true')
    // Playwright treats aria-disabled as disabled; force the click a user can still make.
    await button.click({ force: true })
    await expect(page.getByRole('tooltip')).toHaveText(TIPS.completed)
    expect(backend.posts).toEqual([])
  })

  test('is disabled and spinning while a scan runs', async ({ page }) => {
    const backend = await mockBackend(page, AS_COACH, UPCOMING, 'processing')
    const panel = await openActionsPanel(page)
    const button = panel.getByRole('button', { name: NAME })

    await expect(button).toHaveAttribute('aria-disabled', 'true')
    await expect(button.locator('svg')).toHaveClass(/animate-spin/)
    await button.click({ force: true })
    await expect(page.getByRole('tooltip')).toBeVisible()
    expect(backend.posts).toEqual([])
  })

  test('stays for the coachee after the session day, though Add does not', async ({ page }) => {
    await mockBackend(page, AS_COACHEE, ENDED, 'failed')
    const panel = await openActionsPanel(page)

    await expect(panel.getByRole('button', { name: NAME })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Add' })).toHaveCount(0)
  })
})

test.describe('Rescanning on a phone', () => {
  test.use({ viewport: PHONE, hasTouch: true })

  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
  })

  test('a tap explains a completed scan and a second tap hides it', async ({ page }) => {
    const backend = await mockBackend(page, AS_COACH, UPCOMING, 'completed')
    const sheet = await openActionsSheet(page)
    const button = sheet.getByRole('button', { name: NAME })
    const tooltips = page.getByRole('tooltip')

    await expect(button).toHaveAttribute('aria-disabled', 'true')
    await button.tap({ force: true })
    await expect(tooltips).toHaveText(TIPS.completed)
    await button.tap({ force: true })
    await expect(tooltips).toHaveCount(0)
    expect(backend.posts).toEqual([])

    const box = await button.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(40)
    expect(box!.height).toBeGreaterThanOrEqual(40)

    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width).toBeLessThanOrEqual(PHONE.width)
  })
})
