import { test, expect, type Page } from '@playwright/test'
import { setupAuthentication, mockCommonApiRoutes, MOCK_USER_ID, SINGLE_RELATIONSHIP } from './helpers'

test.use({ timezoneId: 'America/Chicago', locale: 'en-US', viewport: { width: 1280, height: 900 } })

const RELATIONSHIP = { ...SINGLE_RELATIONSHIP[0], coach_id: MOCK_USER_ID }
const COACHEE = { id: RELATIONSHIP.coachee_id, first_name: 'Jane', last_name: 'Smith', display_name: 'Jane Smith' }

const session = (id: string, date: string) => ({
  id,
  coaching_relationship_id: RELATIONSHIP.id,
  date,
  duration_minutes: 50,
  title: null,
  coaching_session_series_id: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
  relationship: RELATIONSHIP,
  coachee: COACHEE,
  topics: [],
})

// Wednesday, October 21 2026, noon in Chicago.
const NOW = '2026-10-21T17:00:00Z'
const THURSDAY = session('thursday', '2026-10-22T15:00:00')
const MONDAY_PAST = session('monday-past', '2026-10-19T15:00:00')
const FAR_BACK = session('far-back', '2026-01-05T15:00:00')
const FAR_AHEAD = session('far-ahead', '2027-01-04T15:00:00')

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
const panel = (page: Page, title: string) => page.getByRole('region', { name: title })

test.describe('Week grid navigation and clicks', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.clock.setFixedTime(NOW)
    await setupAuthentication(page, context)
    await mockCommonApiRoutes(page, { relationships: [RELATIONSHIP] })
    await page.route(
      (url) => url.pathname === `/users/${MOCK_USER_ID}/coaching_sessions`,
      (route) => route.fulfill(json([THURSDAY, MONDAY_PAST]))
    )
    await page.route(
      (url) => url.pathname === `/users/${MOCK_USER_ID}/coaching_sessions/nearest`,
      (route) => route.fulfill(json([FAR_BACK, FAR_AHEAD]))
    )
    await page.goto('/dashboard')
    await expect(page.getByTestId('session-card-thursday')).toBeVisible()
  })

  test('pages between weeks and back to this week', async ({ page }) => {
    await page.getByRole('button', { name: 'Next week' }).click()
    await expect(panel(page, 'Next week')).toContainText('Oct 26 – Nov 1')
    await page.getByRole('button', { name: 'This week' }).click()
    await expect(panel(page, 'This week')).toContainText('Oct 19 – 25')
    await page.getByRole('button', { name: 'Previous week' }).click()
    await expect(panel(page, 'Last week')).toBeVisible()
  })

  test('on a phone the week arrows hold still across weeks, even while one loads', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    // Held until released, prefetches included, so each new week is shown loading first.
    const held: { from: string; release: () => void }[] = []
    const release = (from: string) => held.splice(0).forEach((h) => (h.from === from ? h.release() : held.push(h)))
    await page.route(
      (url) => url.pathname === `/users/${MOCK_USER_ID}/coaching_sessions`,
      async (route) => {
        const from = new URL(route.request().url()).searchParams.get('from_date') ?? ''
        await new Promise<void>((resolve) => held.push({ from, release: resolve }))
        await route.fulfill(json([THURSDAY, MONDAY_PAST]))
      }
    )
    // Reload under the hold and let only this week through, so next week isn't cached yet.
    await page.reload()
    await expect.poll(() => held.some((h) => h.from === '2026-10-19')).toBe(true)
    release('2026-10-19')
    await expect(panel(page, 'This week')).toHaveAttribute('aria-busy', 'false')
    const next = page.getByRole('button', { name: 'Next week' })
    // Measured against the panel, so scrolling the arrow into view to click it doesn't count.
    const top = () =>
      next.evaluate((el) => el.getBoundingClientRect().top - el.closest('section')!.getBoundingClientRect().top)
    const home = await top()
    for (const [title, from] of [['Next week', '2026-10-26'], ['Week of Nov 2', '2026-11-02'], ['Week of Nov 9', '2026-11-09']]) {
      await next.click()
      await expect(panel(page, title)).toHaveAttribute('aria-busy', 'true')
      expect(await top()).toBe(home)
      await expect.poll(() => held.some((h) => h.from === from)).toBe(true)
      release(from)
      await expect(panel(page, title)).toHaveAttribute('aria-busy', 'false')
      expect(await top()).toBe(home)
    }
  })

  test('a single click opens an upcoming session', async ({ page }) => {
    await page.getByTestId('session-card-thursday').click()
    await page.waitForURL('**/coaching-sessions/thursday')
  })

  test('a single click opens a past session', async ({ page }) => {
    await page.getByTestId('session-card-monday-past').click()
    await page.waitForURL('**/coaching-sessions/monday-past')
  })

  test('Schedule session and an empty day open the dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Schedule session' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await page.getByRole('button', { name: 'Schedule on Friday, October 23' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})
