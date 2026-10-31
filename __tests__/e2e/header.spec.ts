import { test, expect, type Page } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
  MULTIPLE_RELATIONSHIPS,
} from './helpers'

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
      const organization = ORGANIZATIONS.find((org) => org.id === id)
      // No fallback: an unexpected id must fail, not silently serve Acme.
      await route.fulfill({
        status: organization ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify(organization ? { data: organization } : {}),
      })
    }
  )
}

// Coaching in two relationships is what shows the Join session trigger.
const COACHING_TWO = MULTIPLE_RELATIONSHIPS.map((rel) => ({ ...rel, coach_id: MOCK_USER_ID }))

async function setup(page: Page, context: Parameters<typeof setupAuthentication>[1]) {
  await setupAuthentication(page, context)
  await mockCommonApiRoutes(page, { relationships: COACHING_TWO })
  await mockOrganizations(page)
}

type Box = { x: number; y: number; width: number; height: number }

const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

const orgTile = (page: Page) => page.getByRole('banner').getByRole('link').first()

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
]) {
  test.describe(`Header organization switch at ${viewport.width}px`, () => {
    test.beforeEach(async ({ page, context }) => {
      await setup(page, context)
      await page.setViewportSize(viewport)
    })

    test('switches organization from the avatar menu', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(orgTile(page)).toHaveAccessibleName('Acme Corp')

      await page.getByRole('button', { name: 'Account menu' }).click()
      const menu = page.getByRole('menu')
      await menu.getByRole('menuitem', { name: /Beta Inc/ }).click()

      await expect(menu).toBeHidden()
      await expect(orgTile(page)).toHaveAccessibleName('Beta Inc')
    })
  })
}

test.describe('Header fits the viewport', () => {
  test.beforeEach(async ({ page, context }) => {
    await setup(page, context)
  })

  for (const width of [360, 1440]) {
    test(`no horizontal scroll on the dashboard at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/dashboard')
      await expect(orgTile(page)).toHaveAccessibleName('Acme Corp')

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    })
  }
})

test.describe('Header items never overlap', () => {
  test.beforeEach(async ({ page, context }) => {
    await setup(page, context)
  })

  for (const width of [320, 360, 375]) {
    test(`at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/dashboard')
      const join = page.getByRole('button', { name: 'Join session' })
      await expect(join).toBeVisible()

      const items = {
        tile: orgTile(page),
        actions: page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Actions' }),
        search: page.getByPlaceholder(/Search sessions/),
        join,
        account: page.getByRole('button', { name: 'Account menu' }),
      }
      const boxes: Record<string, Box> = {}
      for (const [name, locator] of Object.entries(items)) {
        const box = await locator.boundingBox()
        expect(box, name).not.toBeNull()
        boxes[name] = box!
      }
      console.log(`header boxes at ${width}px`, JSON.stringify(boxes))

      const names = Object.keys(boxes)
      for (const [i, a] of names.entries()) {
        for (const b of names.slice(i + 1)) {
          expect(intersects(boxes[a], boxes[b]), `${a} overlaps ${b}`).toBe(false)
        }
      }
    })
  }
})

test('Appearance options fit inside the avatar menu', async ({ page, context }) => {
  await setup(page, context)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/dashboard')

  await page.getByRole('button', { name: 'Account menu' }).click()
  const menu = page.getByRole('menu')
  const auto = menu.getByRole('menuitemradio', { name: 'Auto' })
  await expect(auto).toBeVisible()

  const contentRight = await menu.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    return rect.right - el.clientLeft - parseFloat(getComputedStyle(el).paddingRight)
  })
  const autoBox = (await auto.boundingBox())!
  console.log('menu content right', contentRight, 'Auto right', autoBox.x + autoBox.width)
  expect(autoBox.x + autoBox.width).toBeLessThanOrEqual(contentRight)
})
