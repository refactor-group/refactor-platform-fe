import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { setupAuthentication, mockCommonApiRoutes, MOCK_USER_ID, AUTH_STORE_STATE } from './helpers'

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' })

const relationship = (id: string, coachId: string, coacheeId: string, coach: string, coachee: string) => ({
  id,
  coach_id: coachId,
  coachee_id: coacheeId,
  organization_id: 'org-1',
  coach_first_name: coach.split(' ')[0],
  coach_last_name: coach.split(' ')[1],
  coachee_first_name: coachee.split(' ')[0],
  coachee_last_name: coachee.split(' ')[1],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
})
const person = (id: string, name: string) => ({
  id,
  first_name: name.split(' ')[0],
  last_name: name.split(' ')[1],
  display_name: name,
})

const COACHED_BY_ROSA = relationship('rel-rosa', 'user-rosa', MOCK_USER_ID, 'Rosa Diaz', 'Test User')
const COACHING_JANE = relationship('rel-jane', MOCK_USER_ID, 'user-jane', 'Test User', 'Jane Smith')

const session = (id: string, date: string, rel: ReturnType<typeof relationship>) => ({
  id,
  coaching_relationship_id: rel.id,
  date,
  duration_minutes: 50,
  title: null,
  coaching_session_series_id: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
  relationship: rel,
  coach: person(rel.coach_id, `${rel.coach_first_name} ${rel.coach_last_name}`),
  coachee: person(rel.coachee_id, `${rel.coachee_first_name} ${rel.coachee_last_name}`),
  topics: [],
})

// Wednesday, October 21 2026, noon in Chicago.
const NOW = '2026-10-21T17:00:00Z'
const ROSA_THURSDAY = session('rosa-thursday', '2026-10-22T15:00:00', COACHED_BY_ROSA)
const ROSA_MONDAY = session('rosa-monday', '2026-10-19T15:00:00', COACHED_BY_ROSA)
const JANE_FRIDAY = session('jane-friday', '2026-10-23T15:00:00', COACHING_JANE)
const FAR_AHEAD = session('far-ahead', '2027-01-04T15:00:00', COACHED_BY_ROSA)

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })

async function open(
  page: Page,
  context: BrowserContext,
  input: { isACoach: boolean; relationships: unknown[]; sessions: unknown[] }
) {
  await page.clock.setFixedTime(NOW)
  await setupAuthentication(page, context)
  const auth = JSON.stringify({ ...AUTH_STORE_STATE, state: { ...AUTH_STORE_STATE.state, isACoach: input.isACoach } })
  await page.addInitScript((value) => localStorage.setItem('auth-store', value), auth)
  await mockCommonApiRoutes(page, { relationships: input.relationships as never })
  await page.route(
    (url) => url.pathname === `/users/${MOCK_USER_ID}/coaching_sessions`,
    (route) => route.fulfill(json(input.sessions))
  )
  await page.route(
    (url) => url.pathname === `/users/${MOCK_USER_ID}/coaching_sessions/nearest`,
    (route) => route.fulfill(json([ROSA_MONDAY, FAR_AHEAD]))
  )
  await page.goto('/dashboard')
  await expect(page.getByRole('region', { name: 'This week' })).toBeVisible()
}

const card = (page: Page, id: string) => page.getByTestId(`session-card-${id}`)

async function expectClickOpens(page: Page, id: string) {
  await card(page, id).click()
  await page.waitForURL(`**/coaching-sessions/${id}`)
}

async function menuItems(page: Page, id: string) {
  await card(page, id).click({ button: 'right' })
  const items = page.getByRole('menuitem')
  await expect(items.first()).toBeVisible()
  const names = await items.allTextContents()
  await page.keyboard.press('Escape')
  return names.map((n) => n.trim())
}

test.describe('Week grid for someone who coaches nobody (7.1)', () => {
  test.beforeEach(async ({ page, context }) => {
    await open(page, context, {
      isACoach: false,
      relationships: [COACHED_BY_ROSA],
      sessions: [ROSA_THURSDAY, ROSA_MONDAY],
    })
  })

  test('has no Schedule session, no filter, and no empty-day schedule', async ({ page }) => {
    await expect(card(page, 'rosa-thursday')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Schedule session' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'All sessions' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Schedule on/ })).toHaveCount(0)
  })

  test('a single click opens the session', async ({ page }) => {
    await expectClickOpens(page, 'rosa-thursday')
  })

  test('the menu offers only Open session, upcoming or past', async ({ page }) => {
    expect(await menuItems(page, 'rosa-thursday')).toEqual(['Open session'])
    expect(await menuItems(page, 'rosa-monday')).toEqual(['Open session'])
  })

  test('the week arrows still page', async ({ page }) => {
    await page.getByRole('button', { name: 'Next week' }).click()
    await expect(page.getByRole('region', { name: 'Next week' })).toBeVisible()
    await page.getByRole('button', { name: 'Previous week' }).click()
    await expect(page.getByRole('region', { name: 'This week' })).toBeVisible()
  })
})

test.describe('Week grid for someone who coaches and is coached (7.2)', () => {
  test.beforeEach(async ({ page, context }) => {
    await open(page, context, {
      isACoach: true,
      relationships: [COACHED_BY_ROSA, COACHING_JANE],
      sessions: [ROSA_THURSDAY, JANE_FRIDAY],
    })
  })

  test('shows Schedule session and the filter', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Schedule session' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'All sessions' })).toBeVisible()
  })

  test('a session they coach opens on a click and has the full menu', async ({ page }) => {
    expect(await menuItems(page, 'jane-friday')).toEqual([
      'Open session',
      'Reschedule…',
      'Share link',
      'Resend invite',
      'Cancel session…',
    ])
    await expectClickOpens(page, 'jane-friday')
  })

  test('a session they are coached in behaves as for a coachee', async ({ page }) => {
    expect(await menuItems(page, 'rosa-thursday')).toEqual(['Open session'])
    await expectClickOpens(page, 'rosa-thursday')
  })

  test('the filter lists only the people they coach', async ({ page }) => {
    await page.getByRole('button', { name: 'All sessions' }).click()
    const options = page.getByRole('dialog').getByRole('option')
    await expect(options).toHaveText(['All sessions', 'Jane Smith'])
  })
})
