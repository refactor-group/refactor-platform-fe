import { test, expect } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  SINGLE_RELATIONSHIP,
} from '../../e2e/helpers'

// As of the dashboard sessions-card refactor, the dashboard no longer renders
// the visible CoachingRelationshipSelector. The remaining behavior worth
// asserting is that single-relationship auto-selection STILL happens on
// dashboard mount — UpcomingSessionCard and GoalsOverviewCard depend on a
// selected `currentCoachingRelationshipId` to render their populated state.
test.describe('Dashboard relationship state', () => {
  test('the visible relationship selector is no longer present on the dashboard', async ({
    page,
    context,
  }) => {
    await setupAuthentication(page, context)
    await mockCommonApiRoutes(page, { relationships: SINGLE_RELATIONSHIP })

    await page.goto('/dashboard')

    await expect(
      page.getByText('Coaching Sessions', { exact: true })
    ).toBeVisible({ timeout: 15_000 })

    // The selector trigger should not exist on the dashboard at all.
    await expect(
      page.locator('#coaching-relationship-selector')
    ).toHaveCount(0)
  })

  test('auto-selects the single relationship into sessionStorage on dashboard mount', async ({
    page,
    context,
  }) => {
    await setupAuthentication(page, context)
    await mockCommonApiRoutes(page, { relationships: SINGLE_RELATIONSHIP })

    await page.goto('/dashboard')

    await expect(
      page.getByText('Coaching Sessions', { exact: true })
    ).toBeVisible({ timeout: 15_000 })

    // The Zustand persist middleware flushes asynchronously, so poll until
    // the value appears.
    await expect
      .poll(
        async () => {
          return page.evaluate(() => {
            const stored = sessionStorage.getItem(
              'coaching-relationship-state-store'
            )
            if (!stored) return null
            return (
              JSON.parse(stored).state?.currentCoachingRelationshipId ?? null
            )
          })
        },
        { timeout: 5_000 }
      )
      .toBe('rel-1')
  })
})
