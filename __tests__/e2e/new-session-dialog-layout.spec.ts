import { test, expect, type Page } from '@playwright/test'
import {
  ALEX_TODAY,
  EHAB_TODAY,
  type RelationshipsControl,
  serveAll,
  measureLayout,
  setupDashboard,
  settle,
} from './new-session-dialog-layout-helpers'

// Chromium only: run with --project=chromium.
test.use({ timezoneId: 'America/Chicago', locale: 'en-US' })

interface Viewport {
  width: number
  height: number
}

const VIEWPORTS: Viewport[] = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 899, height: 700 },
  { width: 900, height: 640 },
  { width: 1440, height: 900 },
  { width: 1200, height: 520 },
]

const isDesktop = ({ width }: Viewport) => width >= 900
const sizeOf = ({ width, height }: Viewport) => `${width}×${height}`

// ─── Dialog driving ──────────────────────────────────────────────────

const dialog = (page: Page) => page.locator('[role="dialog"][data-state="open"]')
const button = (page: Page, name: string | RegExp) => dialog(page).getByRole('button', { name })
const personCard = (page: Page, name: string) => dialog(page).locator('button[aria-pressed]').filter({ hasText: name })
const day = (page: Page, label: string) => button(page, new RegExp(`^${label}`))
const startTime = (page: Page) => dialog(page).getByLabel('Start time')
const stepTitle = (page: Page, title: string) => dialog(page).getByRole('heading', { name: title, exact: true })

async function next(page: Page) {
  await button(page, /^Next( step)?$/).click()
}

async function prev(page: Page) {
  await button(page, 'Previous step').click()
}

async function openSchedule(page: Page) {
  await page.getByRole('button', { name: 'Add New' }).click()
  await page.getByRole('menuitem', { name: 'Coaching session' }).click()
  await expect(dialog(page)).toBeVisible()
}

async function openCardAction(page: Page, sessionId: string, testId: string) {
  await page.getByTestId(`session-card-${sessionId}`).click({ button: 'right' })
  await page.getByTestId(testId).click()
  await expect(dialog(page)).toBeVisible()
}

async function choosePerson(page: Page, name: string) {
  await personCard(page, name).click()
  await expect(personCard(page, name)).toHaveAttribute('aria-pressed', 'true')
}

async function setTime(page: Page, value: string) {
  await startTime(page).fill(value)
  await expect(startTime(page)).toHaveValue(value)
}

// ─── Layout check ────────────────────────────────────────────────────

async function checkLayout(page: Page, viewport: Viewport, state: string) {
  await settle(page)
  const report = await page.evaluate(measureLayout, { desktop: isDesktop(viewport) })
  for (const note of report.ellipsis) console.log(`[ellipsis] ${state} at ${sizeOf(viewport)}: ${note}`)
  expect.soft(report.violations, `${state} at ${sizeOf(viewport)}`).toEqual([])
}

async function inState(page: Page, viewport: Viewport, state: string, reach: () => Promise<void>) {
  await test.step(state, async () => {
    await reach()
    await checkLayout(page, viewport, state)
  })
}

async function start(
  page: Page,
  context: Parameters<typeof setupDashboard>[1],
  viewport: Viewport,
  relationships: RelationshipsControl = serveAll()
) {
  await page.setViewportSize(viewport)
  await setupDashboard(page, context, relationships)
  await page.goto('/dashboard')
}

// ─── Tests ───────────────────────────────────────────────────────────

for (const viewport of VIEWPORTS) {
  test.describe(`New session dialog layout at ${sizeOf(viewport)}`, () => {
    test('Who: loaded, everyone, no matches', async ({ page, context }) => {
      await start(page, context, viewport)
      await openSchedule(page)
      await inState(page, viewport, 'Who › loaded', async () => {
        await expect(personCard(page, 'Maximiliana Montgomery-Fitzgerald')).toBeVisible()
        await expect(personCard(page, 'Sarah Kim')).toHaveCount(0)
      })
      await inState(page, viewport, 'Who › Show everyone', async () => {
        await button(page, /^Show everyone/).click()
        await expect(personCard(page, 'Sarah Kim')).toBeVisible()
      })
      await inState(page, viewport, 'Who › no matches', async () => {
        await dialog(page).getByRole('searchbox', { name: 'Find a person' }).fill('zzzz')
        await expect(dialog(page).getByText('No matches')).toBeVisible()
      })
    })

    test('Who: empty', async ({ page, context }) => {
      // Add New hides for someone who coaches nobody, so the list empties after the
      // dashboard loads; the dialog refetches on open, past SWR's 2s dedupe.
      const relationships = serveAll()
      await start(page, context, viewport, relationships)
      await expect(page.getByRole('button', { name: 'Add New' })).toBeVisible()
      await page.waitForTimeout(2500)
      relationships.mode = { kind: 'serve', relationships: [] }
      await openSchedule(page)
      await inState(page, viewport, 'Who › empty', async () => {
        await expect(dialog(page).getByText("You don't coach anyone in this organization yet.")).toBeVisible()
      })
    })

    test('Who: relationships fail', async ({ page, context }) => {
      await start(page, context, viewport, { mode: { kind: 'fail' } })
      await openSchedule(page)
      await inState(page, viewport, 'Who › error', async () => {
        await expect(dialog(page).getByText("Couldn't load the people you coach. Close and try again.")).toBeVisible()
      })
    })

    test('Who: loading', async ({ page, context }) => {
      let release = () => {}
      const until = new Promise<void>((resolve) => (release = resolve))
      await start(page, context, viewport, { mode: { kind: 'hold', until } })
      await openSchedule(page)
      await inState(page, viewport, 'Who › loading', async () => {
        await expect(dialog(page).locator('[aria-busy]')).toBeVisible()
      })
      release()
      await expect(personCard(page, 'Maximiliana Montgomery-Fitzgerald')).toBeVisible()
    })

    test('When: no day, busy day, overlaps', async ({ page, context }) => {
      await start(page, context, viewport)
      await openSchedule(page)
      await choosePerson(page, 'Alex Chen')
      await next(page)
      await inState(page, viewport, 'When › no day selected', async () => {
        await expect(stepTitle(page, 'When')).toBeVisible()
        await expect(dialog(page).locator('[data-testid="month-grid-days"] [aria-pressed="true"]')).toHaveCount(0)
      })
      await inState(page, viewport, 'When › busy day (long Already on list)', async () => {
        await day(page, 'Wednesday, November 18').click()
        await expect(dialog(page).getByText('Already on Wednesday, November 18')).toBeVisible()
        await expect(dialog(page).locator('ul > li')).toHaveCount(7)
      })
      await inState(page, viewport, 'When › overlap with Use … instead', async () => {
        await setTime(page, '09:00')
        await expect(dialog(page).getByText(/Overlaps with Maximiliana/)).toBeVisible()
        await expect(button(page, 'Use 12:00 PM instead')).toBeVisible()
      })
      await inState(page, viewport, 'When › overlap, nothing free after', async () => {
        await day(page, 'Thursday, November 19').click()
        await setTime(page, '15:00')
        await expect(dialog(page).getByText(/Overlaps with Lena/)).toBeVisible()
        await expect(button(page, /instead$/)).toHaveCount(0)
      })
    })

    test('Repeat: none, weekly, ends on, invalid count, confirm', async ({ page, context }) => {
      await start(page, context, viewport)
      await openSchedule(page)
      await choosePerson(page, 'Bartholomew Oyelaran-Castellanos')
      await next(page)
      await expect(day(page, 'Tuesday, November 17')).toHaveAttribute('aria-pressed', 'true')
      await expect(startTime(page)).toHaveValue('11:00')
      await next(page)
      await inState(page, viewport, "Repeat › Doesn't repeat (last step, confirm)", async () => {
        await expect(stepTitle(page, 'Repeat')).toBeVisible()
        await expect(button(page, 'Schedule session')).toBeVisible()
      })
      await inState(page, viewport, 'Repeat › Weekly', async () => {
        await button(page, 'Weekly').click()
        await expect(dialog(page).getByText('Repeats on')).toBeVisible()
        await expect(dialog(page).getByText('Ends', { exact: true })).toBeVisible()
      })
      await inState(page, viewport, "Repeat › Ends 'On' a date", async () => {
        await dialog(page).getByRole('radio', { name: 'On' }).click()
        await expect(dialog(page).getByLabel('End date')).toBeEnabled()
        await expect(button(page, 'Schedule series')).toBeVisible()
      })
      await inState(page, viewport, 'Repeat › invalid count', async () => {
        await dialog(page).getByRole('radio', { name: 'After' }).click()
        await dialog(page).getByLabel('Number of sessions').fill('0')
        await expect(dialog(page).getByRole('alert')).toBeVisible()
      })
    })

    test('Resolve overlap: movable, unmovable, confirm', async ({ page, context }) => {
      await start(page, context, viewport)
      await openSchedule(page)
      await choosePerson(page, 'Daniel Wu')
      await next(page)
      await day(page, 'Thursday, November 19').click()
      await setTime(page, '15:00')
      await next(page)
      await next(page)
      await inState(page, viewport, 'Resolve › movable clash (time chips)', async () => {
        await expect(stepTitle(page, 'Resolve overlap')).toBeVisible()
        await expect(button(page, '9:00 AM')).toBeVisible()
      })
      await inState(page, viewport, 'Resolve › moved (last step, confirm)', async () => {
        await button(page, '9:00 AM').click()
        await expect(button(page, 'Schedule session')).toBeVisible()
      })
      await prev(page)
      await prev(page)
      await day(page, 'Friday, November 20').click()
      await setTime(page, '10:00')
      await next(page)
      await next(page)
      await inState(page, viewport, 'Resolve › unmovable clash (keep both only)', async () => {
        await expect(stepTitle(page, 'Resolve overlap')).toBeVisible()
        await expect(button(page, /^Keep both at/)).toBeVisible()
        await expect(button(page, '9:00 AM')).toHaveCount(0)
      })
      await inState(page, viewport, 'Resolve › kept both (last step, confirm)', async () => {
        await button(page, /^Keep both at/).click()
        await expect(button(page, 'Schedule session')).toBeVisible()
      })
    })

    test('Reschedule a one-off: unchanged, changed', async ({ page, context }) => {
      await start(page, context, viewport)
      await openCardAction(page, ALEX_TODAY.id, 'session-action-reschedule')
      await inState(page, viewport, 'Move › When unchanged (hint)', async () => {
        await expect(dialog(page).getByText('Alex Chen')).toBeVisible()
        await expect(dialog(page).getByText(/^Currently /)).toBeVisible()
        await expect(button(page, 'Reschedule session')).toHaveCount(0)
      })
      await inState(page, viewport, 'Move › When changed (confirm)', async () => {
        await setTime(page, '12:00')
        await expect(button(page, 'Reschedule session')).toBeVisible()
      })
    })

    test('Reschedule a series session: Applies to, this and following', async ({ page, context }) => {
      await start(page, context, viewport)
      await openCardAction(page, EHAB_TODAY.id, 'session-action-reschedule')
      await expect(stepTitle(page, 'When')).toBeVisible()
      await next(page)
      await inState(page, viewport, 'Series › Applies to', async () => {
        await expect(stepTitle(page, 'Applies to')).toBeVisible()
        await expect(dialog(page).getByRole('radio')).toHaveCount(2)
        await expect(dialog(page).getByText(/series repeats weekly/)).toBeVisible()
      })
      await dialog(page).getByRole('radio', { name: /This and following sessions/ }).click()
      await next(page)
      await inState(page, viewport, 'Series › Repeat (this and following)', async () => {
        await expect(stepTitle(page, 'Repeat')).toBeVisible()
        await expect(button(page, 'Weekly')).toBeVisible()
        await expect(button(page, "Doesn't repeat")).toHaveCount(0)
      })
    })

    test('Edit series opens on this and following', async ({ page, context }) => {
      await start(page, context, viewport)
      await openCardAction(page, EHAB_TODAY.id, 'session-action-edit-series')
      await inState(page, viewport, 'Edit series › When', async () => {
        await expect(stepTitle(page, 'When')).toBeVisible()
      })
      await next(page)
      await inState(page, viewport, 'Edit series › Applies to', async () => {
        await expect(dialog(page).getByRole('radio', { name: /This and following sessions/ })).toBeChecked()
      })
    })

    if (viewport.width === 900 || viewport.width === 1440) {
      test('busy-day tooltips stay inside the viewport', async ({ page, context }) => {
        await start(page, context, viewport)
        await openSchedule(page)
        await choosePerson(page, 'Alex Chen')
        await next(page)
        for (const [state, label] of [
          ['Monday column', 'Monday, November 23'],
          ['Sunday column', 'Sunday, November 29'],
          ['busy day, 7 sessions', 'Wednesday, November 18'],
        ] as const) {
          await test.step(`Tooltip › ${state}`, async () => {
            await page.mouse.move(0, 0)
            await day(page, label).hover()
            await page.waitForTimeout(500)
            await expectTooltipInside(page, viewport, `Tooltip › ${state}`)
          })
        }
      })
    }
  })
}

async function expectTooltipInside(page: Page, viewport: Viewport, state: string) {
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toHaveCount(1)
  await settle(page)
  // The visible content is the popper wrapper's child; role="tooltip" may sit on it or inside it.
  const box = await tooltip.evaluate((el) => {
    const wrapper = el.closest('[data-radix-popper-content-wrapper]')
    const r = (wrapper?.firstElementChild ?? el).getBoundingClientRect()
    return { x: r.left, y: r.top, right: r.right, bottom: r.bottom }
  })
  const where = `${state} at ${sizeOf(viewport)}: tooltip ${Math.round(box.x)},${Math.round(box.y)} → ${Math.round(box.right)},${Math.round(box.bottom)}`
  expect.soft(box.x, where).toBeGreaterThanOrEqual(-1)
  expect.soft(box.y, where).toBeGreaterThanOrEqual(-1)
  expect.soft(box.right, where).toBeLessThanOrEqual(viewport.width + 1)
  expect.soft(box.bottom, where).toBeLessThanOrEqual(viewport.height + 1)
}
