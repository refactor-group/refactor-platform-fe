import { test, expect, type Page, type Route } from '@playwright/test'
import { setupAuthentication, mockCommonApiRoutes, MOCK_USER_ID, SINGLE_RELATIONSHIP } from './helpers'

// Chromium only: run with --project=chromium.
test.use({ timezoneId: 'America/Chicago', locale: 'en-US' })

const NOW = '2026-08-25T19:00:00Z' // 2:00 PM in Chicago

const PEOPLE = [
  ['rel-a', 'alex', 'Alex', 'Chen'],
  ['rel-d', 'daniel', 'Daniel', 'Wu'],
  ['rel-e', 'ehab', 'Ehab', 'Badawi'],
  ['rel-l', 'lena', 'Lena', 'Torres'],
  ['rel-p', 'priya', 'Priya', 'Raman'],
  ['rel-s', 'sarah', 'Sarah', 'Kim'],
] as const

const RELATIONSHIPS = PEOPLE.map(([id, coacheeId, first, last]) => ({
  ...SINGLE_RELATIONSHIP[0],
  id,
  coach_id: MOCK_USER_ID,
  coachee_id: coacheeId,
  coachee_first_name: first,
  coachee_last_name: last,
}))

const relationship = (id: string) => RELATIONSHIPS.find((rel) => rel.id === id)!

const session = (id: string, relId: string, date: string, title: string) => {
  const rel = relationship(relId)
  return {
    id,
    coaching_relationship_id: relId,
    date,
    duration_minutes: 60,
    title: null,
    display_title: title,
    coaching_session_series_id: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    relationship: rel,
    coachee: {
      id: rel.coachee_id,
      first_name: rel.coachee_first_name,
      last_name: rel.coachee_last_name,
      display_name: `${rel.coachee_first_name} ${rel.coachee_last_name}`,
    },
  }
}

const EHAB_TODAY = session('e7', 'rel-e', '2026-08-25T21:30:00', 'Delegating the hiring loop')
const DANIEL_KICKOFF = session('d1', 'rel-d', '2026-08-14T15:00:00', 'Kickoff')

// Newest first, as the endpoint returns them.
const NEAREST: Record<string, ReturnType<typeof session>[]> = {
  'rel-a': [
    session('a3', 'rel-a', '2026-09-02T15:00:00', 'Session 3'),
    session('a2', 'rel-a', '2026-08-12T15:00:00', 'Saying no to new clients'),
    session('a1', 'rel-a', '2026-08-05T15:00:00', 'Session 1'),
  ],
  'rel-d': [session('d2', 'rel-d', '2026-08-28T15:00:00', 'Session 2'), DANIEL_KICKOFF],
  'rel-l': [session('l1', 'rel-l', '2026-08-20T15:00:00', 'Pricing the retainer')],
  'rel-e': [
    session('e8', 'rel-e', '2026-09-01T15:00:00', 'Session 8'),
    EHAB_TODAY,
    session('e6', 'rel-e', '2026-08-18T15:00:00', 'Session 6'),
  ],
}

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })

type NearestRequest = { relationshipId: string; around: string; before: string; after: string }

type NearestHandler = (route: Route, relationshipId: string) => Promise<void>

const serveNearest: NearestHandler = (route, relationshipId) =>
  route.fulfill(json(NEAREST[relationshipId] ?? []))

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Swap `handle` to change how `/nearest` answers from then on. */
type NearestControl = { requests: NearestRequest[]; handle: NearestHandler }

async function setup(page: Page, context: Parameters<typeof setupAuthentication>[1]) {
  const nearest: NearestControl = { requests: [], handle: serveNearest }
  await page.clock.setFixedTime(NOW)
  await setupAuthentication(page, context)
  await mockCommonApiRoutes(page, { relationships: RELATIONSHIPS })
  // Registered after mockCommonApiRoutes so these win (routes match LIFO).
  await page.route(
    (url) => url.pathname === `/users/${MOCK_USER_ID}/coaching_sessions`,
    (route) => route.fulfill(json([EHAB_TODAY]))
  )
  await page.route('**/coaching_sessions/counts**', (route) => route.fulfill(json({ counts: [] })))
  await page.route(
    (url) => url.pathname === `/coaching_sessions/${DANIEL_KICKOFF.id}`,
    (route) => route.fulfill(json(DANIEL_KICKOFF))
  )
  await page.route('**/coaching_sessions/nearest**', (route) => {
    const params = new URL(route.request().url()).searchParams
    const relationshipId = params.get('coaching_relationship_id') ?? ''
    nearest.requests.push({
      relationshipId,
      around: params.get('around') ?? '',
      before: params.get('before') ?? '',
      after: params.get('after') ?? '',
    })
    return nearest.handle(route, relationshipId)
  })
  return nearest
}

const trigger = (page: Page) => page.getByRole('button', { name: 'Join session' })
const menu = (page: Page) => page.getByRole('dialog', { name: 'Join session' })
const person = (page: Page, firstName: string) =>
  menu(page).locator('button[aria-pressed]').filter({ hasText: firstName })

async function openMenu(page: Page) {
  await trigger(page).click()
  await expect(menu(page)).toBeVisible()
}

test.describe('Join session menu', () => {
  let nearest: NearestControl
  let requests: NearestRequest[]

  test.beforeEach(async ({ page, context }) => {
    nearest = await setup(page, context)
    requests = nearest.requests
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test('shows the Today block and the first person by default', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(trigger(page)).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(requests).toEqual([])
    await openMenu(page)

    const today = menu(page).locator('section').filter({ hasText: 'Today' }).first()
    await expect(today).toContainText('Ehab Badawi')
    await expect(today).toContainText('Today · 4:30 PM')
    await expect(person(page, 'Alex')).toHaveAttribute('aria-pressed', 'true')
    await expect(menu(page).getByText('Saying no to new clients')).toBeVisible()
    expect(requests).toEqual([{ relationshipId: 'rel-a', around: NOW, before: '2', after: '2' }])
  })

  test('pages the carousel', async ({ page }) => {
    await page.goto('/dashboard')
    await openMenu(page)

    const prev = menu(page).getByRole('button', { name: 'Previous people' })
    const next = menu(page).getByRole('button', { name: 'Next people' })
    await expect(prev).toBeDisabled()
    await expect(person(page, 'Priya')).toBeVisible()

    await next.click()
    await expect(next).toBeDisabled()
    await expect(prev).toBeEnabled()
    const sarah = person(page, 'Sarah')
    await expect(sarah).toBeInViewport()
    await sarah.click()
    await expect(sarah).toHaveAttribute('aria-pressed', 'true')
    await expect(menu(page)).toBeVisible()
    await expect(menu(page).getByText('No sessions with Sarah yet')).toBeVisible()
  })

  test('picking a person re-requests their sessions', async ({ page }) => {
    await page.goto('/dashboard')
    await openMenu(page)
    await expect(menu(page).getByText('Saying no to new clients')).toBeVisible()

    await person(page, 'Daniel').click()

    await expect(menu(page).getByText('Kickoff')).toBeVisible()
    await expect(menu(page).getByText('Saying no to new clients')).toBeHidden()
    expect(requests.at(-1)).toEqual({ relationshipId: 'rel-d', around: NOW, before: '2', after: '2' })
  })

  test("today's person anchors on the today session", async ({ page }) => {
    await page.goto('/dashboard')
    await openMenu(page)
    await person(page, 'Ehab').click()

    await expect(menu(page).getByText('Session 8')).toBeVisible()
    expect(requests.at(-1)).toEqual({
      relationshipId: 'rel-e',
      around: EHAB_TODAY.date,
      before: '2',
      after: '3',
    })
  })

  test('hovering a dot shows exactly one tooltip', async ({ page }) => {
    await page.goto('/dashboard')
    await openMenu(page)

    await menu(page).getByRole('button', { name: 'Aug 12 · Saying no to new clients' }).hover()
    const tooltips = menu(page).locator('.bg-inverse')
    await expect(tooltips).toHaveCount(1)
    await expect(tooltips).toHaveText('Aug 12 · Saying no to new clients')
  })

  test('a row opens its session and confirms', async ({ page }) => {
    await page.goto('/dashboard')
    await openMenu(page)

    await menu(page).getByText('Saying no to new clients').click()

    await expect(page).toHaveURL(/\/coaching-sessions\/a2$/)
    await expect(menu(page)).toBeHidden()
    await expect(page.getByText('Opened Alex · Aug 12 · Saying no to new clients')).toBeVisible()
  })

  test('on a session page the current row is marked', async ({ page }) => {
    await page.goto(`/coaching-sessions/${DANIEL_KICKOFF.id}`)
    await openMenu(page)

    await expect(person(page, 'Daniel')).toHaveAttribute('aria-pressed', 'true')
    const current = menu(page).locator('[aria-current="true"]')
    await expect(current).toContainText('Kickoff')
    await expect(current).toContainText('Current')
    await expect(menu(page).getByText('Current', { exact: true })).toHaveCount(1)
    expect(requests.filter((r) => r.relationshipId === 'rel-d')).toEqual([
      { relationshipId: 'rel-d', around: DANIEL_KICKOFF.date, before: '2', after: '3' },
    ])
  })

  test('Esc and an outside click close the menu', async ({ page }) => {
    await page.goto('/dashboard')
    await openMenu(page)
    await page.keyboard.press('Escape')
    await expect(menu(page)).toBeHidden()

    await openMenu(page)
    await page.mouse.click(20, 400)
    await expect(menu(page)).toBeHidden()
  })

  for (const width of [320, 375]) {
    test(`stays inset at ${width}px without horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 })
      await page.goto('/dashboard')
      await openMenu(page)
      await expect(menu(page).getByText('Saying no to new clients')).toBeVisible()

      // toPass waits out the open animation's scale.
      await expect(async () => {
        const box = (await menu(page).boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(16 - 0.5)
        expect(box.x + box.width).toBeLessThanOrEqual(width - 16 + 0.5)
      }).toPass()
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })
  }

  test('lines up with the trigger at 1280px', async ({ page }) => {
    await page.goto('/dashboard')
    await openMenu(page)
    await expect(menu(page).getByText('Saying no to new clients')).toBeVisible()

    const pill = (await trigger(page).boundingBox())!
    await expect(async () => {
      const box = (await menu(page).boundingBox())!
      expect(Math.abs(box.x + box.width - (pill.x + pill.width))).toBeLessThanOrEqual(1)
    }).toPass()
  })

  test('a failed request offers Try again', async ({ page }) => {
    nearest.handle = (route) => route.abort('failed')
    await page.goto('/dashboard')
    await openMenu(page)

    await expect(menu(page).getByText("Couldn't load sessions")).toBeVisible()
    nearest.handle = serveNearest
    await menu(page).getByRole('button', { name: 'Try again' }).click()

    await expect(menu(page).getByText('Saying no to new clients')).toBeVisible()
    await expect(menu(page).getByText("Couldn't load sessions")).toBeHidden()
  })

  test('a server error shows the error state and no rows', async ({ page }) => {
    nearest.handle = (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'internal' }) })
    await page.goto('/dashboard')
    await openMenu(page)

    await expect(menu(page).getByText("Couldn't load sessions")).toBeVisible()
    await expect(menu(page).getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(menu(page).getByText(/^(Upcoming|Previous)$/)).toHaveCount(0)
    await expect(menu(page).getByText('Saying no to new clients')).toBeHidden()
  })

  test('a slow response shows placeholder rows first', async ({ page }) => {
    nearest.handle = async (route, relationshipId) => {
      await sleep(1500)
      await serveNearest(route, relationshipId)
    }
    await page.goto('/dashboard')
    await openMenu(page)

    await expect(menu(page).getByLabel('Loading sessions')).toBeVisible()
    await expect(menu(page).getByText('Saying no to new clients')).toBeHidden()
    await expect(menu(page).getByText('Saying no to new clients')).toBeVisible({ timeout: 5000 })
    await expect(menu(page).getByLabel('Loading sessions')).toBeHidden()
  })

  test('a session page that fails to load falls back to now', async ({ page }) => {
    await page.route(
      (url) => url.pathname === '/coaching_sessions/missing',
      (route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) })
    )
    await page.goto('/coaching-sessions/missing')
    await openMenu(page)
    await expect(page).toHaveURL(/\/coaching-sessions\/missing$/)

    await expect(person(page, 'Alex')).toHaveAttribute('aria-pressed', 'true')
    await expect(menu(page).getByText('Saying no to new clients')).toBeVisible()
    await expect(menu(page).getByLabel('Loading sessions')).toBeHidden()
    await expect(menu(page).getByText('Current', { exact: true })).toHaveCount(0)
    expect(requests).toEqual([{ relationshipId: 'rel-a', around: NOW, before: '2', after: '2' }])
  })

  test('switching people quickly ends on the last one', async ({ page }) => {
    const delays: Record<string, number> = { 'rel-d': 2000, 'rel-e': 300, 'rel-l': 0 }
    nearest.handle = async (route, relationshipId) => {
      await sleep(delays[relationshipId] ?? 0)
      await serveNearest(route, relationshipId)
    }
    await page.goto('/dashboard')
    await openMenu(page)
    await expect(menu(page).getByText('Saying no to new clients')).toBeVisible()

    await person(page, 'Daniel').click()
    await person(page, 'Ehab').click()
    await person(page, 'Lena').click()
    await expect(menu(page).getByText('Pricing the retainer')).toBeVisible()

    // Flags any later render of the slow person's rows.
    await page.evaluate(() => {
      const w = window as unknown as { sawSlowRows: boolean }
      w.sawSlowRows = false
      new MutationObserver(() => {
        const dialog = document.querySelector('[role="dialog"]')
        if (dialog?.textContent?.includes('Kickoff')) w.sawSlowRows = true
      }).observe(document.body, { childList: true, subtree: true, characterData: true })
    })
    await expect.poll(() => requests.filter((r) => r.relationshipId === 'rel-d').length).toBe(1)
    await page.waitForTimeout(2500)

    expect(await page.evaluate(() => (window as unknown as { sawSlowRows: boolean }).sawSlowRows)).toBe(false)
    await expect(person(page, 'Lena')).toHaveAttribute('aria-pressed', 'true')
    await expect(menu(page).getByText('Pricing the retainer')).toBeVisible()
    await expect(menu(page).getByText('Kickoff')).toBeHidden()
  })
})
