import { test, expect, type Page } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
  SINGLE_RELATIONSHIP,
} from './helpers'

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' })

const RELATIONSHIP = { ...SINGLE_RELATIONSHIP[0], coach_id: MOCK_USER_ID }
const COACHEE = { id: RELATIONSHIP.coachee_id, first_name: 'Jane', last_name: 'Smith', display_name: 'Jane Smith' }

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
  relationship: RELATIONSHIP,
  coachee: COACHEE,
})

const SERIES_SESSION = session('series-session', '2026-10-21T21:00:00', {
  id: 'series-1',
  last_session_date: '2026-12-30T21:00:00',
})
const PAST_ONE_OFF = session('past-one-off', '2026-10-21T14:00:00', null)

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })

let resendPosts: string[]

async function openRowMenu(page: Page, sessionId: string) {
  const row = page.getByRole('region', { name: 'Today' }).getByTestId(`session-row-${sessionId}`)
  await row.hover()
  await row.getByRole('button', { name: 'Session actions' }).click()
}

test.describe('Resend calendar invite', () => {
  test.beforeEach(async ({ page, context }) => {
    resendPosts = []
    await page.clock.setFixedTime('2026-10-21T17:00:00Z')
    await setupAuthentication(page, context)
    await mockCommonApiRoutes(page, { relationships: [RELATIONSHIP] })
    await page.route(
      (url) => url.pathname === `/users/${MOCK_USER_ID}/coaching_sessions`,
      (route) => route.fulfill(json([SERIES_SESSION, PAST_ONE_OFF]))
    )
    await page.route('**/coaching_sessions/counts**', (route) => route.fulfill(json({ counts: [] })))
    await page.route('**/resend_invite', (route) => {
      resendPosts.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`)
      return route.fulfill({ status: 204 })
    })
    await page.goto('/dashboard')
  })

  test('a double-clicked confirm sends one series resend', async ({ page }) => {
    await openRowMenu(page, SERIES_SESSION.id)
    await page.getByRole('menuitem', { name: 'Resend series invite' }).click()
    await page
      .getByRole('alertdialog', { name: 'Resend series invite?' })
      .getByRole('button', { name: 'Resend invite' })
      .dblclick()

    await expect(page.getByText('Invite sent to you and Jane Smith')).toBeVisible()
    expect(resendPosts).toEqual(['POST /coaching_session_series/series-1/resend_invite'])
  })

  test('the item is disabled on a past one-off', async ({ page }) => {
    await page.getByRole('tab', { name: 'Previous' }).click()
    await openRowMenu(page, PAST_ONE_OFF.id)

    const item = page.getByTestId('session-row-resend-invite')
    await expect(item).toHaveAttribute('aria-disabled', 'true')
    await expect(item).toContainText('No upcoming sessions')
  })
})
