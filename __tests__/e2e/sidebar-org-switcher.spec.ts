import { test, expect, type Page } from '@playwright/test'
import { setupAuthentication, mockCommonApiRoutes } from './helpers'

// The mobile sidebar renders inside a sheet while the underlying sidebar state
// stays collapsed. The switcher used to key its icon-only (non-interactive)
// rendering off that state alone, leaving mobile users with an avatar they
// could not tap.

const ORGANIZATIONS = [
  {
    id: 'org-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'org-2',
    name: 'Beta Inc',
    slug: 'beta-inc',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

// Registered after mockCommonApiRoutes so these win (routes match LIFO).
async function mockOrganizations(page: Page) {
  await page.route(
    (url) => url.pathname.endsWith('/organizations'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: ORGANIZATIONS }),
      })
    }
  )
  await page.route(
    (url) => /\/organizations\/org-\d+$/.test(url.pathname),
    async (route) => {
      const id = route.request().url().split('/').pop()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: ORGANIZATIONS.find((org) => org.id === id) ?? ORGANIZATIONS[0],
        }),
      })
    }
  )
}

test.describe('Organization switcher on mobile', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
    await mockCommonApiRoutes(page)

    await mockOrganizations(page)

    await page.setViewportSize({ width: 375, height: 812 })
  })

  test('opens a bottom sheet and switches organization', async ({ page }) => {
    await page.goto('/dashboard')

    await page.getByRole('button', { name: 'Expand sidebar' }).click()

    const trigger = page.getByRole('button', {
      name: 'Switch organization: Acme Corp',
    })
    await expect(trigger).toBeVisible()
    await trigger.click()

    // The sheet is a dialog anchored to the bottom of the viewport.
    const sheet = page.getByRole('dialog', { name: 'Switch organization' })
    await expect(sheet).toBeVisible()

    // Polled: the sheet slides up, so it only reaches the bottom edge once the
    // open animation settles.
    await expect(async () => {
      const box = await sheet.boundingBox()
      expect(box).not.toBeNull()
      expect(Math.round(box!.y + box!.height)).toBe(812)
    }).toPass({ timeout: 5000 })

    await sheet.getByRole('button', { name: /Beta Inc/ }).click()

    // Sheet and the sidebar behind it both get out of the way.
    await expect(sheet).toBeHidden()
    await expect(
      page.getByRole('button', { name: /Switch organization/ })
    ).toBeHidden()
  })
})

// Collapsed, the rail has room for the avatar alone. Clicking it has to both
// widen the sidebar and open the menu, across the re-render between the two
// layouts.
test.describe('Organization switcher on the collapsed desktop rail', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
    await mockCommonApiRoutes(page)
    await mockOrganizations(page)
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test('clicking the avatar expands the sidebar and opens the menu', async ({
    page,
  }) => {
    await page.goto('/dashboard')

    await page.getByRole('button', { name: /Collapse sidebar/i }).click()

    // Collapsed: the avatar carries the switcher's name, the label does not.
    const avatar = page.getByRole('button', { name: /Switch organization/ })
    await expect(avatar).toBeVisible()
    await expect(page.getByRole('menu')).toBeHidden()

    await avatar.click()

    await expect(page.getByRole('menuitem', { name: /Beta Inc/ })).toBeVisible()
    // The menu tracks the trigger as the rail widens, so it ends up as wide as
    // the expanded sidebar rather than the icon rail.
    await expect(async () => {
      const box = await page.getByRole('menu').boundingBox()
      expect(box).not.toBeNull()
      expect(box!.width).toBeGreaterThan(150)
    }).toPass({ timeout: 5000 })
  })
})
