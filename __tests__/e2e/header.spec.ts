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
        search: page.getByRole('button', { name: 'Open search' }),
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

      expect(Math.abs(boxes.account.x + boxes.account.width - (width - 16))).toBeLessThanOrEqual(1)

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

const hitBase = {
  score: 0.5,
  snippet: null,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
  organization_id: 'org-1',
  coaching_relationship_id: 'rel-1',
}

// Server order deliberately differs from the grouped order.
const SEARCH_HITS = [
  { ...hitBase, type: 'topic', id: 'topic-1', title: 'Weekly energy', coaching_session_id: 'sess-1', status: 'open' },
  { ...hitBase, type: 'action', id: 'action-1', title: 'Draft the weekly plan', coaching_session_id: 'sess-1', status: 'not_started' },
  { ...hitBase, type: 'coaching_session', id: 'sess-1', title: 'Weekly review', date: '2026-09-03T10:00:00' },
  { ...hitBase, type: 'goal', id: 'goal-1', title: 'Weekly planning habit', status: 'in_progress' },
  { ...hitBase, type: 'agreement', id: 'agr-1', title: 'Plan every Monday', coaching_session_id: 'sess-1' },
]

type WidthSample = { t: number; width: number }
type WidthWindow = { collapseWidths: Promise<WidthSample[]> }

// Runs in the page: records the root's width each frame for 300ms after the next Escape.
function recordWidthAfterEscape(root: Element) {
  ;(window as unknown as WidthWindow).collapseWidths = new Promise((resolve) => {
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape') return
        const start = performance.now()
        const widths: WidthSample[] = []
        const tick = () => {
          const t = performance.now() - start
          widths.push({ t: Math.round(t), width: Math.round(root.getBoundingClientRect().width) })
          if (t < 300) requestAnimationFrame(tick)
          else resolve(widths)
        }
        requestAnimationFrame(tick)
      },
      { capture: true, once: true }
    )
  })
}

async function mockSearch(page: Page) {
  await page.route(
    (url) => url.pathname.endsWith('/search'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { hits: SEARCH_HITS, next_cursor: null } }),
      })
    }
  )
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
]) {
  test(`Global search groups results at ${viewport.width}px`, async ({ page, context }) => {
    await setup(page, context)
    await mockSearch(page)
    await page.setViewportSize(viewport)
    await page.goto('/dashboard')
    const openSearch = page.getByRole('button', { name: 'Open search' })
    await expect(openSearch).toBeVisible()

    await page.keyboard.press('ControlOrMeta+k')
    const input = page.getByRole('combobox', { name: 'Search' })
    await expect(input).toBeFocused()
    await input.fill('weekly')

    const headings = page.locator('[cmdk-group-heading]')
    await expect(headings).toHaveText(['Sessions', 'Goals', 'Actions', 'Agreements', 'Topics'])

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

    const panel = (await page.locator('[cmdk-list]').locator('xpath=ancestor::div[contains(@class,"rounded-popover")]').boundingBox())!
    console.log(`search panel at ${viewport.width}px`, JSON.stringify(panel))
    expect(panel.x).toBeGreaterThanOrEqual(0)
    expect(panel.x + panel.width).toBeLessThanOrEqual(viewport.width)

    if (viewport.width < 640) {
      const account = page.getByRole('button', { name: 'Account menu' })
      const box = (await account.boundingBox())!
      const covered = await account.evaluate(
        (el, [x, y]) => !el.contains(document.elementFromPoint(x, y)),
        [box.x + box.width / 2, box.y + box.height / 2]
      )
      expect(covered, 'expanded search covers the account button').toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(input).toHaveValue('')
    await expect(input).toBeFocused()
    await page.locator('[cmdk-root]').locator('..').evaluate(recordWidthAfterEscape)
    await page.keyboard.press('Escape')
    if (viewport.width >= 640) {
      const widths = await page.evaluate(() => (window as unknown as WidthWindow).collapseWidths)
      const at80 = widths.reduce((a, b) => (Math.abs(b.t - 80) < Math.abs(a.t - 80) ? b : a))
      console.log('search root width during collapse', JSON.stringify(widths))
      expect(at80.width).toBeGreaterThan(36)
      expect(at80.width).toBeLessThan(340)
    }
    await expect(input).toBeHidden()
    await expect(openSearch).toBeVisible()
    await expect(openSearch).toBeFocused()
  })
}
