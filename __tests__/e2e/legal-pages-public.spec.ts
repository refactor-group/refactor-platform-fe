import { test, expect } from '@playwright/test'

// Deliberately no setupAuthentication: these routes must render for a signed-out
// visitor. Google's OAuth verification reviewers reach them without a session,
// so an auth gate added later would silently fail verification.

const LIMITED_USE_SENTENCE =
  "Refactor's use and transfer of information received from Google APIs to any " +
  'other app will adhere to the Google API Services User Data Policy, including ' +
  'the Limited Use requirements.'

test.describe('Legal pages are publicly reachable', () => {
  test('privacy policy renders anonymously and carries the Limited Use disclosure', async ({
    page,
  }) => {
    const response = await page.goto('/privacy')

    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/privacy$/)
    await expect(
      page.getByRole('heading', { name: 'Privacy Policy', level: 1 })
    ).toBeVisible()

    await expect(page.getByText(LIMITED_USE_SENTENCE)).toBeVisible()
  })

  test('terms of service renders anonymously', async ({ page }) => {
    const response = await page.goto('/terms')

    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/terms$/)
    await expect(
      page.getByRole('heading', { name: 'Terms of Service', level: 1 })
    ).toBeVisible()
  })

  test('the login page links resolve to both documents', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Terms of Service' }).click()
    await expect(page).toHaveURL(/\/terms$/)

    await page.goto('/')

    await page.getByRole('link', { name: 'Privacy Policy' }).click()
    await expect(page).toHaveURL(/\/privacy$/)
  })
})
