import { test, expect } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
} from '../../e2e/helpers'

test.describe('State Management Flows', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
    await mockCommonApiRoutes(page)
  })

  test('should maintain organization state through navigation', async ({
    page,
  }) => {
    await page.goto('/dashboard')

    // Wait for the dashboard to render before checking storage.
    await expect(
      page.getByText('Coaching Sessions', { exact: true })
    ).toBeVisible({ timeout: 15_000 })

    // Verify the organization state written by setupAuthentication survives
    // the page load (organization-state-store is in localStorage).
    const orgId = await page.evaluate(() => {
      const stored = localStorage.getItem('organization-state-store')
      return stored ? JSON.parse(stored).state.currentOrganizationId : null
    })

    expect(orgId).toBe('org-1')
  })

  // Note: coaching relationship auto-selection is tested in
  // coaching-relationship-selector-visibility.spec.ts ("should auto-select
  // single relationship and keep selector hidden").

  test('should handle 403 API errors gracefully on the dashboard', async ({
    page,
  }) => {
    // Override coaching_sessions to return 403
    await page.route('**/coaching_sessions**', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden' }),
      })
    })

    await page.goto('/dashboard')

    // The app should not crash — verify the dashboard still renders its
    // key heading despite the 403 on coaching_sessions.
    await expect(
      page.getByText('Coaching Sessions', { exact: true })
    ).toBeVisible({ timeout: 15_000 })

    expect(page.url()).toContain('/dashboard')
  })

  test('should persist auth state across page refreshes', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(
      page.getByText('Coaching Sessions', { exact: true })
    ).toBeVisible({ timeout: 15_000 })

    // Refresh — addInitScript re-runs, so auth state should survive.
    await page.reload()

    await expect(
      page.getByText('Coaching Sessions', { exact: true })
    ).toBeVisible({ timeout: 15_000 })

    const authState = await page.evaluate(() => {
      const stored = localStorage.getItem('auth-store')
      return stored ? JSON.parse(stored).state : null
    })

    expect(authState).not.toBeNull()
    expect(authState.isLoggedIn).toBe(true)
    expect(authState.userId).toBe('user-123')
  })

  test('should not crash when session validation returns 401', async ({
    page,
  }) => {
    // Override session validation to return 401
    await page.route('**/users/validate_session', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { user_id: MOCK_USER_ID, is_valid: false },
        }),
      })
    })

    await page.goto('/dashboard')

    // Wait for the page to settle — either the app redirects away from
    // the protected route or it renders the dashboard despite the 401.
    await page.waitForURL(/./, { timeout: 15_000 })

    const currentUrl = page.url()
    const isOnProtectedRoute = currentUrl.includes('/dashboard')

    if (!isOnProtectedRoute) {
      // Redirected away from the protected route — expected behavior
      expect(currentUrl).not.toContain('/dashboard')
    } else {
      // Still on dashboard — addInitScript re-populates auth state in
      // localStorage on every load, so the app may not redirect even with
      // a 401 from validate_session. Verify it still renders key UI.
      await expect(
        page.getByText('Coaching Sessions', { exact: true })
      ).toBeVisible({ timeout: 15_000 })
    }
  })
})
