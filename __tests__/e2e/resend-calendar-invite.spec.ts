import { test, expect, type Page, type Route } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
  SINGLE_RELATIONSHIP,
} from './helpers'

// Resending a calendar invite from the dashboard session menu, against a mocked backend.

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' })

const NOW = '2026-10-21T17:00:00Z'
const SERIES_ID = 'series-1'
const RELATIONSHIP = { ...SINGLE_RELATIONSHIP[0], coach_id: MOCK_USER_ID }

const person = (id: string, first: string, last: string) => ({
  id,
  email: `${first.toLowerCase()}@example.com`,
  first_name: first,
  last_name: last,
  display_name: `${first} ${last}`,
  timezone: 'America/Chicago',
  roles: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

const session = (id: string, date: string, series: { id: string; last_session_date: string } | null) => ({
  id,
  coaching_relationship_id: RELATIONSHIP.id,
  date,
  duration_minutes: 60,
  title: null,
  coaching_session_series_id: series?.id ?? null,
  series,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
  relationship: {
    id: RELATIONSHIP.id,
    coach_id: MOCK_USER_ID,
    coachee_id: RELATIONSHIP.coachee_id,
    organization_id: 'org-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  coach: person(MOCK_USER_ID, 'Test', 'User'),
  coachee: person(RELATIONSHIP.coachee_id, 'Jane', 'Smith'),
})

const SERIES_SESSION = session('series-session', '2026-10-21T21:00:00', {
  id: SERIES_ID,
  last_session_date: '2026-12-30T21:00:00',
})
const PAST_ONE_OFF = session('past-one-off', '2026-10-21T14:00:00', null)

const json = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ data }),
})

async function mockDashboard(page: Page): Promise<string[]> {
  const resendPosts: string[] = []
  await mockCommonApiRoutes(page, { relationships: [RELATIONSHIP] })
  await page.route(
    (url) => url.pathname === `/users/${MOCK_USER_ID}/coaching_sessions`,
    (route) => route.fulfill(json([SERIES_SESSION, PAST_ONE_OFF]))
  )
  await page.route('**/coaching_sessions/counts**', (route) => route.fulfill(json({ counts: [] })))
  await page.route('**/resend_invite', (route: Route) => {
    resendPosts.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`)
    return route.fulfill({ status: 204 })
  })
  return resendPosts
}

async function openRowMenu(page: Page, sessionId: string) {
  const row = page.getByRole('region', { name: 'Today' }).getByTestId(`session-row-${sessionId}`)
  await row.hover()
  await row.getByRole('button', { name: 'Session actions' }).click()
}

test.describe('Resend calendar invite', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.clock.setFixedTime(NOW)
    await setupAuthentication(page, context)
  })

  test('a double-clicked confirm sends one series resend', async ({ page }) => {
    const resendPosts = await mockDashboard(page)
    await page.goto('/dashboard')

    await openRowMenu(page, SERIES_SESSION.id)
    await page.getByRole('menuitem', { name: 'Resend series invite' }).click()

    const dialog = page.getByRole('alertdialog', { name: 'Resend series invite?' })
    await dialog.getByRole('button', { name: 'Resend invite' }).dblclick()

    await expect(page.getByText('Invite sent to you and Jane Smith')).toBeVisible()
    expect(resendPosts).toEqual([`POST /coaching_session_series/${SERIES_ID}/resend_invite`])
  })

  test('the item is disabled on a past one-off', async ({ page }) => {
    await mockDashboard(page)
    await page.goto('/dashboard')

    await page.getByRole('tab', { name: 'Previous' }).click()
    await openRowMenu(page, PAST_ONE_OFF.id)

    const item = page.getByTestId('session-row-resend-invite')
    await expect(item).toHaveAttribute('aria-disabled', 'true')
    await expect(item).toContainText('No upcoming sessions')
  })
})
