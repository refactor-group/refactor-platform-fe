import { test, expect } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  SINGLE_RELATIONSHIP,
  MULTIPLE_RELATIONSHIPS,
} from '../../e2e/helpers'

test.describe('CoachingRelationshipSelector Visibility', () => {
  test('should hide selector when user has only 1 coaching relationship', async ({
    page,
    context,
  }) => {
    await setupAuthentication(page, context)
    await mockCommonApiRoutes(page, { relationships: SINGLE_RELATIONSHIP })

    await page.goto('/dashboard')

    // Wait for the dashboard card heading to render – proves the page loaded.
    // Use exact match to avoid matching substrings in other elements.
    await expect(
      page.getByText('Coaching Sessions', { exact: true })
    ).toBeVisible({ timeout: 15_000 })

    // The selector trigger should exist in the DOM but be hidden because
    // CoachingSessionList applies the `hidden` class when there is only
    // one relationship.
    const selector = page.locator('#coaching-relationship-selector')
    await expect(selector).toBeHidden()
  })

  test('should show selector when user has 2 or more coaching relationships', async ({
    page,
    context,
  }) => {
    await setupAuthentication(page, context)
    await mockCommonApiRoutes(page, { relationships: MULTIPLE_RELATIONSHIPS })

    await page.goto('/dashboard')

    await expect(
      page.getByText('Coaching Sessions', { exact: true })
    ).toBeVisible({ timeout: 15_000 })

    const selector = page.locator('#coaching-relationship-selector')
    await expect(selector).toBeVisible()
  })

  test('should auto-select single relationship and keep selector hidden', async ({
    page,
    context,
  }) => {
    await setupAuthentication(page, context)
    await mockCommonApiRoutes(page, { relationships: SINGLE_RELATIONSHIP })

    await page.goto('/dashboard')

    await expect(
      page.getByText('Coaching Sessions', { exact: true })
    ).toBeVisible({ timeout: 15_000 })

    // The selector should remain hidden
    const selector = page.locator('#coaching-relationship-selector')
    await expect(selector).toBeHidden()

    // Verify auto-selection wrote the relationship ID to sessionStorage.
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
