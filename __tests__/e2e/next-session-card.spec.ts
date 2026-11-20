import { test, expect, type Page, type BrowserContext, type Locator } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  mockRelationship,
  sessionParticipants,
  MOCK_USER_ID,
  COACH_VIEWER,
} from './helpers'

test.use({ timezoneId: 'America/Chicago', locale: 'en-US', viewport: { width: 1280, height: 900 } })

const seat = (name: string) => {
  const [first_name, last_name] = name.split(' ')
  return { first_name, last_name }
}
const relationship = (id: string, coacheeId: string, coachee: string) =>
  mockRelationship(
    id,
    { coach_id: MOCK_USER_ID, coachee_id: coacheeId, viewer: COACH_VIEWER },
    { coach: seat('Test User'), coachee: seat(coachee) }
  )
type Relationship = ReturnType<typeof relationship>

const COACHING_JANE = relationship('rel-jane', 'user-jane', 'Jane Smith')
const COACHING_SAM = relationship('rel-sam', 'user-sam', 'Sam Lee')

const TOPIC = (sessionId: string, n: number) => ({
  id: `topic-${sessionId}-${n}`,
  coaching_session_id: sessionId,
  user_id: 'user-jane',
  body: `Topic ${n}`,
  status: 'open',
  moved_from_session_id: null,
  created_at: '2026-11-10T12:00:00Z',
  updated_at: '2026-11-10T12:00:00Z',
})

const GOAL = (id: string) => ({
  id,
  coaching_relationship_id: COACHING_JANE.id,
  created_in_session_id: null,
  user_id: 'user-jane',
  title: `Goal ${id}`,
  body: null,
  status: 'InProgress',
  status_changed_at: '2026-11-01T12:00:00Z',
  completed_at: '2026-11-01T12:00:00Z',
  target_date: null,
  created_at: '2026-11-01T12:00:00Z',
  updated_at: '2026-11-01T12:00:00Z',
})

const session = (id: string, date: string, rel: Relationship, extra: { topics?: unknown[]; goals?: unknown[] } = {}) => ({
  id,
  coaching_relationship_id: rel.id,
  date,
  duration_minutes: 50,
  title: null,
  coaching_session_series_id: null,
  series: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
  relationship: rel,
  participants: sessionParticipants(rel),
  topics: extra.topics ?? [],
  goals: extra.goals ?? [],
})
type Session = ReturnType<typeof session>

// Thursday, November 19 2026, 2:00 PM in Chicago. The week runs Mon Nov 16 to Sun Nov 22.
const NOW = '2026-11-19T20:00:00Z'
const JANE_TODAY = session('jane-today', '2026-11-19T20:30:00', COACHING_JANE, {
  topics: [TOPIC('jane-today', 1), TOPIC('jane-today', 2)],
  goals: [GOAL('goal-1'), GOAL('goal-2')],
})
const JANE_PREV = session('jane-prev', '2026-11-12T20:30:00', COACHING_JANE)
const SAM_TOMORROW = session('sam-tomorrow', '2026-11-20T16:00:00', COACHING_SAM)
const SAM_SATURDAY = session('sam-saturday', '2026-11-21T17:00:00', COACHING_SAM)
const SAM_NEXT_MONDAY = session('sam-next-monday', '2026-11-23T16:00:00', COACHING_SAM)
const ALL = [JANE_TODAY, SAM_TOMORROW, SAM_SATURDAY, SAM_NEXT_MONDAY]

const action = (id: string, status: string, dueBy: string) => ({
  id,
  coaching_session_id: JANE_PREV.id,
  goal_id: null,
  body: `Action ${id}`,
  user_id: MOCK_USER_ID,
  status,
  status_changed_at: '2026-11-12T21:30:00Z',
  due_by: dueBy,
  created_at: '2026-11-12T21:30:00Z',
  updated_at: '2026-11-12T21:30:00Z',
  assignee_ids: ['user-jane'],
})
const JANE_ACTIONS = [
  action('a-overdue', 'NotStarted', '2026-11-18T18:00:00Z'),
  action('a-done', 'Completed', '2026-11-18T18:00:00Z'),
  action('a-today', 'InProgress', '2026-11-19T18:00:00Z'),
]

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })

enum ClockMode {
  Fixed = 'fixed',
  Running = 'running',
}

interface Scenario {
  sessions: Session[]
  clock?: { mode: ClockMode; at: string }
  delayMs?: number
  /** While true, the user's sessions answer 500. */
  failing?: { value: boolean }
}

async function open(page: Page, context: BrowserContext, scenario: Scenario) {
  const clock = scenario.clock ?? { mode: ClockMode.Fixed, at: NOW }
  if (clock.mode === ClockMode.Fixed) await page.clock.setFixedTime(clock.at)
  else await page.clock.install({ time: new Date(clock.at) })

  await setupAuthentication(page, context)
  await mockCommonApiRoutes(page, { relationships: [COACHING_JANE, COACHING_SAM] })

  const requests: URL[] = []
  await page.route(
    (url) => url.pathname === `/users/${MOCK_USER_ID}/coaching_sessions`,
    async (route) => {
      const url = new URL(route.request().url())
      requests.push(url)
      if (scenario.delayMs) await new Promise((r) => setTimeout(r, scenario.delayMs))
      if (scenario.failing?.value) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      }
      const from = url.searchParams.get('from_date') ?? ''
      const to = url.searchParams.get('to_date') ?? ''
      await route.fulfill(json(scenario.sessions.filter((s) => from <= s.date.slice(0, 10) && s.date.slice(0, 10) <= to)))
    }
  )
  await page.route(
    (url) => url.pathname === `/users/${MOCK_USER_ID}/coaching_sessions/nearest`,
    (route) => route.fulfill(json([]))
  )
  await page.route(
    (url) => url.pathname === '/coaching_sessions' && url.searchParams.has('coaching_relationship_id'),
    (route) => {
      const rel = new URL(route.request().url()).searchParams.get('coaching_relationship_id')
      return route.fulfill(json(rel === COACHING_JANE.id ? [JANE_PREV, JANE_TODAY] : []))
    }
  )
  await page.route(
    (url) => url.pathname === `/users/${MOCK_USER_ID}/actions`,
    (route) => {
      const params = new URL(route.request().url()).searchParams
      const jane = params.get('coaching_relationship_id') === COACHING_JANE.id && params.get('scope') === 'sessions'
      return route.fulfill(json(jane ? JANE_ACTIONS : []))
    }
  )
  await page.route(
    (url) => url.pathname.endsWith('/goal_progress'),
    (route) => route.fulfill(json({ goal_progress: [] }))
  )

  await page.goto('/dashboard')
  await expect(briefing(page)).toBeVisible()
  return { requests }
}

const briefing = (page: Page) => page.getByRole('region', { name: "Today's Briefing" })
const nextCard = (page: Page) => page.getByTestId('next-session-card')
const goalsCard = (page: Page) => page.getByTestId('goals-overview-card')
const headline = (page: Page) => nextCard(page).getByRole('heading', { level: 3 })
const glanceButton = (page: Page) => nextCard(page).getByRole('button', { name: 'At a glance' })
const row = (page: Page, label: string) => nextCard(page).getByRole('link', { name: new RegExp(`^${label}`) })
const rowValue = (page: Page, label: string) => row(page, label).locator('span').first()

/** WCAG contrast of `fg`'s text color against the nearest opaque background at or above `bg`. */
async function contrast(page: Page, fg: Locator, bg: Locator): Promise<number> {
  const handles = [await fg.elementHandle(), await bg.elementHandle()]
  return page.evaluate(([fgEl, bgEl]) => {
    // A canvas pixel turns any CSS color (hsl, oklch, named) into sRGB bytes.
    const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d')!
    const rgba = (color: string) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      return { rgb: [r, g, b], opaque: a === 255 }
    }
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    let back = [255, 255, 255]
    for (let node: Element | null = bgEl!; node; node = node.parentElement) {
      const c = rgba(getComputedStyle(node).backgroundColor)
      if (c.opaque) {
        back = c.rgb
        break
      }
    }
    const [hi, lo] = [luminance(rgba(getComputedStyle(fgEl!).color).rgb), luminance(back)].sort((a, b) => b - a)
    return (hi + 0.05) / (lo + 0.05)
  }, handles)
}

test.describe('Next session card on a desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop widths; the phone describe covers Mobile Chrome.')

  test('(2.1) the briefing shows its title and date, with no Welcome or Add New', async ({ page, context }) => {
    await open(page, context, { sessions: ALL })
    await expect(page.getByRole('heading', { name: "Today's Briefing" })).toBeVisible()
    await expect(briefing(page).getByText('Thursday, November 19')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add New' })).toHaveCount(0)
    await expect(page.getByText(/^Welcome/)).toHaveCount(0)
  })

  test('(2.2) the cards sit side by side at equal height, and stack below md', async ({ page, context }) => {
    await open(page, context, { sessions: ALL })
    await expect(headline(page)).toBeVisible()
    const next = (await nextCard(page).boundingBox())!
    const goals = (await goalsCard(page).boundingBox())!
    expect(next.x).toBeLessThan(goals.x)
    expect(Math.abs(next.y - goals.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(next.height - goals.height)).toBeLessThanOrEqual(1)

    await page.setViewportSize({ width: 760, height: 900 })
    await expect
      .poll(async () => {
        const n = (await nextCard(page).boundingBox())!
        const g = (await goalsCard(page).boundingBox())!
        return n.y + n.height <= g.y + 1
      })
      .toBe(true)
  })

  test("(3.1) today's next session comes first", async ({ page, context }) => {
    await open(page, context, { sessions: ALL })
    await expect(headline(page)).toHaveText('Today with Jane at 2:30 PM')
  })

  test('(3.2) the card moves on once a session ends, without a reload', async ({ page, context }) => {
    await open(page, context, { sessions: ALL, clock: { mode: ClockMode.Running, at: NOW } })
    await expect(headline(page)).toHaveText('Today with Jane at 2:30 PM')
    // A session is past a minute after it ends, then the next 30s tick picks it up.
    await page.clock.runFor((30 + 50 + 1) * 60_000 + 31_000)
    await expect(headline(page)).toHaveText('Tomorrow with Sam at 10:00 AM')
  })

  test('(3.3) later this week: tomorrow, then a weekday', async ({ page, context }) => {
    await open(page, context, { sessions: [SAM_TOMORROW, SAM_SATURDAY, SAM_NEXT_MONDAY] })
    await expect(headline(page)).toHaveText('Tomorrow with Sam at 10:00 AM')
    await expect(nextCard(page).getByText('Fri, Nov 20')).toBeVisible()
  })

  test('(3.3) with tomorrow gone too, the weekday reads by name', async ({ page, context }) => {
    await open(page, context, { sessions: [SAM_SATURDAY, SAM_NEXT_MONDAY] })
    await expect(headline(page)).toHaveText('Saturday with Sam at 11:00 AM')
  })

  test("(3.4) next Monday's session isn't this week's", async ({ page, context }) => {
    await open(page, context, { sessions: [SAM_NEXT_MONDAY] })
    await expect(nextCard(page).getByText('No more sessions this week.')).toBeVisible()
    await expect(nextCard(page).getByText('Check back on Monday.')).toBeVisible()
  })

  test("(3.5) the goals card follows, from the week's one request", async ({ page, context }) => {
    const { requests } = await open(page, context, { sessions: ALL })
    await expect(headline(page)).toHaveText('Today with Jane at 2:30 PM')
    await expect(goalsCard(page)).toContainText('Jane')

    const includes = (url: URL) => (url.searchParams.get('include') ?? '').split(',')
    const thisWeek = requests.filter((url) => url.searchParams.get('from_date') === '2026-11-16')
    expect(thisWeek.length).toBeGreaterThan(0)
    for (const url of thisWeek) expect(includes(url)).toContain('goal')
    for (const url of requests) expect(includes(url)).not.toContain('organization')
  })

  test('(4.1 tick) the countdown ticks without a reload', async ({ page, context }) => {
    await open(page, context, { sessions: ALL, clock: { mode: ClockMode.Running, at: '2026-11-19T20:05:00Z' } })
    await expect(nextCard(page).getByText('Starts in 25 mins')).toBeVisible()
    await expect(nextCard(page).locator('.animate-ping')).toHaveCount(1)
    await page.clock.runFor(60_000)
    await expect(nextCard(page).getByText('Starts in 24 mins')).toBeVisible()
  })

  test('(5.1) At a glance opens by default and folds from its header', async ({ page, context }) => {
    await open(page, context, { sessions: ALL })
    await expect(glanceButton(page)).toHaveAttribute('aria-expanded', 'true')
    const openSession = nextCard(page).getByRole('link', { name: 'Open session' })
    const cardBefore = (await nextCard(page).boundingBox())!
    const pillBefore = (await openSession.boundingBox())!
    await glanceButton(page).click()
    await expect(glanceButton(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(row(page, 'Topics')).toBeHidden()
    const cardAfter = (await nextCard(page).boundingBox())!
    const pillAfter = (await openSession.boundingBox())!
    expect(Math.abs(cardAfter.height - cardBefore.height)).toBeLessThanOrEqual(1)
    expect(Math.abs(pillAfter.y - pillBefore.y)).toBeLessThanOrEqual(1)
    await glanceButton(page).focus()
    await page.keyboard.press('Tab')
    await expect(openSession).toBeFocused()
    await glanceButton(page).click()
    await expect(glanceButton(page)).toHaveAttribute('aria-expanded', 'true')
  })

  test('(5.2 / 5.5) row values and links', async ({ page, context }) => {
    await open(page, context, { sessions: ALL })
    await expect(rowValue(page, 'Topics')).toHaveText('2')
    await expect(rowValue(page, 'Actions due')).toHaveText('1 overdue')
    await expect(rowValue(page, 'Goals')).toHaveText('2 active')
    await expect(row(page, 'Actions due')).toHaveAttribute('href', /\?panel=actions&actions=due/)
    await expect(row(page, 'Agreements from last session')).toHaveAttribute(
      'href',
      '/coaching-sessions/jane-prev?panel=agreements'
    )
    await expect(nextCard(page).getByRole('link', { name: 'Open session' })).toHaveAttribute(
      'href',
      '/coaching-sessions/jane-today'
    )
  })

  test('(7.1) empty as a coach offers Schedule a session', async ({ page, context }) => {
    await open(page, context, { sessions: [] })
    const schedule = nextCard(page).getByRole('button', { name: 'Schedule a session' })
    await expect(schedule).toBeVisible()
    await schedule.click()
    await expect(page.getByRole('dialog', { name: 'New session' })).toBeVisible()
  })

  test('(7.3) loading keeps the height and never pulses', async ({ page, context }) => {
    const loading = nextCard(page).getByText('Loading your next session')
    const opened = open(page, context, { sessions: ALL, delayMs: 1500 })
    await expect(loading).toBeAttached({ timeout: 15_000 })
    const before = (await nextCard(page).boundingBox())!.height
    await expect(nextCard(page).locator('.animate-pulse')).toHaveCount(0)
    await opened
    await expect(headline(page)).toHaveText('Today with Jane at 2:30 PM')
    const after = (await nextCard(page).boundingBox())!.height
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1)
  })

  test('(7.4) an error offers Try again, which loads the card', async ({ page, context }) => {
    const failing = { value: true }
    await open(page, context, { sessions: ALL, failing })
    await expect(nextCard(page).getByText("Couldn't load your next session")).toBeVisible({ timeout: 15_000 })
    failing.value = false
    await nextCard(page).getByRole('button', { name: 'Try again' }).click()
    await expect(headline(page)).toHaveText('Today with Jane at 2:30 PM')
  })

  test.describe('in Dark', () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' })
    })

    test('(8.1) the error title and icon are readable', async ({ page, context }) => {
      await open(page, context, { sessions: ALL, failing: { value: true } })
      await expect(page.locator('html')).toHaveClass(/\bdark\b/)
      const title = nextCard(page).getByText("Couldn't load your next session")
      await expect(title).toBeVisible({ timeout: 15_000 })
      const icon = nextCard(page).locator('svg').first()
      const badge = icon.locator('xpath=..')
      expect(await contrast(page, title, nextCard(page))).toBeGreaterThanOrEqual(4.5)
      expect(await contrast(page, icon, badge)).toBeGreaterThanOrEqual(4.5)
    })

    test('(8.1) the overdue value is readable', async ({ page, context }) => {
      await open(page, context, { sessions: ALL })
      await expect(page.locator('html')).toHaveClass(/\bdark\b/)
      const overdue = rowValue(page, 'Actions due')
      await expect(overdue).toHaveText('1 overdue')
      expect(await contrast(page, overdue, overdue)).toBeGreaterThanOrEqual(4.5)
    })
  })

  test('(8.3) Tab walks the header, the rows, then Open session; Space folds', async ({ page, context }) => {
    await open(page, context, { sessions: ALL })
    await expect(rowValue(page, 'Actions due')).toHaveText('1 overdue')
    await glanceButton(page).focus()
    const order = [
      row(page, 'Topics'),
      row(page, 'Actions due'),
      row(page, 'Agreements from last session'),
      row(page, 'Goals'),
      nextCard(page).getByRole('link', { name: 'Open session' }),
    ]
    for (const target of order) {
      await page.keyboard.press('Tab')
      await expect(target).toBeFocused()
    }
    for (let i = 0; i < order.length; i++) await page.keyboard.press('Shift+Tab')
    await expect(glanceButton(page)).toBeFocused()
    await page.keyboard.press('Space')
    await expect(glanceButton(page)).toHaveAttribute('aria-expanded', 'false')
  })
})

test.describe('Next session card on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  test('(8.2) no horizontal scroll, and 44px targets', async ({ page, context }) => {
    await open(page, context, { sessions: ALL })
    await expect(rowValue(page, 'Actions due')).toHaveText('1 overdue')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
    const targets = [
      glanceButton(page),
      row(page, 'Topics'),
      row(page, 'Actions due'),
      row(page, 'Agreements from last session'),
      row(page, 'Goals'),
      nextCard(page).getByRole('link', { name: 'Open session' }),
    ]
    for (const target of targets) {
      expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
  })
})
