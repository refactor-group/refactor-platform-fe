import { test, expect, type Page, type Locator } from '@playwright/test'
import { setupAuthentication, mockCommonApiRoutes, MOCK_USER_ID, SINGLE_RELATIONSHIP } from './helpers'

test.use({ timezoneId: 'America/Chicago', locale: 'en-US', viewport: { width: 1440, height: 900 } })

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
// Thursday 10:00 AM and Friday 9:00 AM in Chicago.
const THURSDAY = session('thursday', '2026-10-22T15:00:00')
const FRIDAY = session('friday', '2026-10-23T14:00:00')
const MONDAY_PAST = session('monday-past', '2026-10-19T15:00:00')

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })

let writes: { id: string; date: string }[]

async function dragTo(page: Page, from: Locator, overDay: Locator, to: () => Locator) {
  const a = await from.boundingBox()
  if (!a) throw new Error('no source box')
  await page.mouse.move(a.x + a.width / 2, a.y + 20)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + 30, { steps: 5 })
  const d = await overDay.boundingBox()
  if (!d) throw new Error('no day box')
  await page.mouse.move(d.x + d.width / 2, d.y + 40, { steps: 10 })
  const target = to()
  await expect(target).toBeVisible()
  const t = await target.boundingBox()
  if (!t) throw new Error('no target box')
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 10 })
  await page.mouse.up()
}

const day = (page: Page, name: string) => page.getByRole('group', { name })
const slot = (page: Page, iso: string, time: string) => page.getByTestId(`drop-slot-${iso}-${time}`)

test.describe('Week grid drag to move', () => {
  test.beforeEach(async ({ page, context }) => {
    writes = []
    await page.clock.setFixedTime(NOW)
    await setupAuthentication(page, context)
    await mockCommonApiRoutes(page, { relationships: [RELATIONSHIP] })
    await page.route(
      (url) => url.pathname === `/users/${MOCK_USER_ID}/coaching_sessions`,
      (route) => route.fulfill(json([THURSDAY, FRIDAY, MONDAY_PAST]))
    )
    await page.route(
      (url) => url.pathname === `/users/${MOCK_USER_ID}/coaching_sessions/nearest`,
      (route) => route.fulfill(json([]))
    )
    await page.route(
      (url) => /^\/coaching_sessions\/[^/]+$/.test(url.pathname),
      async (route) => {
        if (route.request().method() !== 'PUT') return route.fallback()
        const body = route.request().postDataJSON()
        writes.push({ id: new URL(route.request().url()).pathname.split('/').pop() ?? '', date: body.date })
        return route.fulfill(json(body))
      }
    )
    await page.goto('/dashboard')
    await expect(page.getByTestId('session-card-thursday')).toBeVisible()
  })

  test('the narrowest grid shows a card\'s length in full', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    const card = page.getByTestId('session-card-thursday')
    const length = card.getByText('· 50 min', { exact: true })
    await expect(length).toBeVisible()
    const clipped = await length.evaluate((el) => {
      const box = el.getBoundingClientRect()
      const cardBox = el.closest('[data-testid]')!.getBoundingClientRect()
      return el.scrollWidth > el.clientWidth || box.right > cardBox.right
    })
    expect(clipped).toBe(false)
  })

  test('dropping on a free slot moves this session, and Undo puts it back', async ({ page }) => {
    await dragTo(page, page.getByTestId('session-card-thursday'), day(page, 'Friday, October 23'), () =>
      slot(page, '2026-10-23', '10:00')
    )
    await expect(page.getByText('Moved Jane to Fri, 10:00 AM · this session only')).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/dashboard')
    expect(writes).toEqual([{ id: 'thursday', date: '2026-10-23T15:00:00' }])
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => writes.length).toBe(2)
    expect(writes[1]).toEqual({ id: 'thursday', date: '2026-10-22T15:00:00' })
  })

  test('the hovered day unfolds into named slots across working hours', async ({ page }) => {
    const card = page.getByTestId('session-card-thursday')
    const a = await card.boundingBox()
    if (!a) throw new Error('no box')
    await page.mouse.move(a.x + 40, a.y + 20)
    await page.mouse.down()
    await page.mouse.move(a.x + 60, a.y + 40, { steps: 5 })
    const friday = day(page, 'Friday, October 23')
    const d = await friday.boundingBox()
    if (!d) throw new Error('no box')
    await page.mouse.move(d.x + d.width / 2, d.y + 40, { steps: 10 })
    await expect(slot(page, '2026-10-23', '08:00')).toBeVisible()
    // A 50-minute session's last start still ends by 5:30 PM.
    await expect(slot(page, '2026-10-23', '16:30')).toBeVisible()
    await expect(slot(page, '2026-10-23', '17:00')).toHaveCount(0)
    await expect(slot(page, '2026-10-23', '09:00')).toContainText('Jane')
    await page.mouse.up()
  })

  test('dropping on a taken slot opens the reschedule dialog at that time, without moving', async ({ page }) => {
    await dragTo(page, page.getByTestId('session-card-thursday'), day(page, 'Friday, October 23'), () =>
      slot(page, '2026-10-23', '09:00')
    )
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Resolve overlap' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /at 9:00 AM$/ })).toBeVisible()
    expect(writes).toEqual([])
  })

  test('a past day never unfolds, and dropping elsewhere moves nothing', async ({ page }) => {
    const card = page.getByTestId('session-card-thursday')
    const a = await card.boundingBox()
    if (!a) throw new Error('no box')
    await page.mouse.move(a.x + 40, a.y + 20)
    await page.mouse.down()
    await page.mouse.move(a.x + 60, a.y + 40, { steps: 5 })
    const monday = day(page, 'Monday, October 19')
    const m = await monday.boundingBox()
    if (!m) throw new Error('no box')
    await page.mouse.move(m.x + m.width / 2, m.y + 40, { steps: 10 })
    await expect(page.getByTestId(/^drop-slot-2026-10-19-/)).toHaveCount(0)
    const title = await page.getByRole('heading', { name: 'This week' }).boundingBox()
    if (!title) throw new Error('no box')
    await page.mouse.move(title.x + 10, title.y + 5, { steps: 10 })
    await page.mouse.up()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    // A real move after it: had the stray drop written, its PUT would land first.
    await dragTo(page, card, day(page, 'Friday, October 23'), () => slot(page, '2026-10-23', '10:00'))
    await expect.poll(() => writes.length).toBe(1)
    expect(writes).toEqual([{ id: 'thursday', date: '2026-10-23T15:00:00' }])
  })

  test('a quick click opens, and a right-click opens the menu without a drag', async ({ page }) => {
    await page.getByTestId('session-card-thursday').click({ button: 'right' })
    await expect(page.getByRole('menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByTestId('session-card-thursday').click()
    await page.waitForURL('**/coaching-sessions/thursday')
    expect(writes).toEqual([])
  })

  test('only upcoming cards the viewer coaches can drag', async ({ page }) => {
    await expect(page.getByTestId('session-card-thursday')).toHaveAttribute('data-draggable', 'true')
    await expect(page.getByTestId('session-card-monday-past')).toHaveAttribute('data-draggable', 'false')
    const card = page.getByTestId('session-card-monday-past')
    const a = await card.boundingBox()
    if (!a) throw new Error('no box')
    await page.mouse.move(a.x + 40, a.y + 20)
    await page.mouse.down()
    await page.mouse.move(a.x + 300, a.y + 40, { steps: 10 })
    await expect(page.getByTestId(/^drop-slot-/)).toHaveCount(0)
    await page.mouse.up()
  })
})
