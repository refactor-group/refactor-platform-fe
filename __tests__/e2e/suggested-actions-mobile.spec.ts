import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  SINGLE_RELATIONSHIP,
} from './helpers'

// Suggested action cards must fit a phone screen and keep 40px touch targets.

const VIEWPORT = { width: 390, height: 844 }
const SESSION_ID = 'session-suggest-1'
const RELATIONSHIP = SINGLE_RELATIONSHIP[0]

const MOCK_SESSION = {
  id: SESSION_ID,
  coaching_relationship_id: RELATIONSHIP.id,
  date: '2026-10-11T16:30:00Z',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}

function wireSuggestion(
  id: string,
  body: string,
  quote: string,
  assigneeIds: string[],
  duplicateOf: { action_id: string; body: string } | null = null
) {
  return {
    id,
    coaching_session_id: SESSION_ID,
    proposal: {
      id: '00000000-0000-0000-0000-000000000000',
      coaching_session_id: SESSION_ID,
      goal_id: null,
      body,
      user_id: RELATIONSHIP.coach_id,
      status: 'NotStarted',
      status_changed_at: '2026-10-11T17:00:00Z',
      due_by: null,
      created_at: '2026-10-11T17:00:00Z',
      updated_at: '2026-10-11T17:00:00Z',
      assignee_ids: assigneeIds,
      due_phrase: 'soonish',
    },
    quote,
    segment: { id: `seg-${id}`, start_ms: 754000, speaker_role: 'coachee', speaker_label: 'Jane Smith' },
    duplicate_of: duplicateOf,
    default_due: { at: '2026-10-18T16:30:00Z', source: 'next_session' },
    created_at: '2026-10-11T17:05:00Z',
  }
}

const SUGGESTIONS = [
  wireSuggestion(
    'sug-long',
    'Draft the quarterly hiring plan with headcount, budget, interview loops and a timeline, then share it with Dana and the leadership team before the offsite so everyone can comment ahead of time',
    `I'll write it up in our ${'supercalifragilisticexpialidocious'.repeat(3)} planning doc and send it over.`,
    [RELATIONSHIP.coachee_id],
    {
      action_id: 'act-existing',
      body: 'Write up the quarterly hiring plan with headcount, budget and interview loops for the leadership offsite next month',
    }
  ),
  wireSuggestion(
    'sug-short',
    'Book a call with Dana',
    'Let me book a call with Dana.',
    [RELATIONSHIP.coach_id, RELATIONSHIP.coachee_id]
  ),
]

const resolved = (by: string) => ({ resolved_by: by, resolved_at: '2026-10-11T17:10:00Z' })

const DISMISSED = [
  {
    ...wireSuggestion(
      'dis-long',
      `Send the ${'antidisestablishmentarianism'.repeat(4)} notes to Dana`,
      'Dismissed quote one about the notes.',
      [RELATIONSHIP.coachee_id]
    ),
    ...resolved(RELATIONSHIP.coachee_id),
  },
  {
    ...wireSuggestion(
      'dis-coach',
      'Review the onboarding checklist',
      'Dismissed quote two about the checklist.',
      [RELATIONSHIP.coach_id]
    ),
    ...resolved(RELATIONSHIP.coach_id),
  },
]

// Opens the panel sheet and switches it to Actions as a user would.
async function openActionsSheet(page: Page): Promise<Locator> {
  await page.goto(`/coaching-sessions/${SESSION_ID}`)
  const mobilePanel = page.locator('div.md\\:hidden')
  await mobilePanel.getByRole('button').first().click()
  // The Radix popover is also a dialog; the sheet is the one with the panel.
  const sheet = page.getByRole('dialog').filter({ has: page.getByRole('combobox') })
  await sheet.getByRole('combobox').click()
  await page.getByRole('option', { name: /Actions/ }).click()
  return sheet
}

test.describe('Suggested actions on mobile', () => {
  test.beforeEach(async ({ page, context }) => {
    await page.setViewportSize(VIEWPORT)
    await setupAuthentication(page, context)
    await page.addInitScript((relId) => {
      sessionStorage.setItem(
        'coaching-relationship-state-store',
        JSON.stringify({ state: { currentCoachingRelationshipId: relId }, version: 1 })
      )
    }, RELATIONSHIP.id)
    await mockCommonApiRoutes(page, { coachingSessions: [MOCK_SESSION] })
    await page.route('**/coaching_relationships/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: RELATIONSHIP }),
      })
    })
    await page.route('**/coaching_sessions/*/transcript_suggestions**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status_code: 200, data: SUGGESTIONS }),
      })
    })
    // Registered last so it wins over the pending route above.
    await page.route('**/transcript_suggestions?*status=dismissed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status_code: 200, data: DISMISSED }),
      })
    })
  })

  test('cards fit the screen and keep 40px touch targets', async ({ page }) => {
    const sheet = await openActionsSheet(page)

    // The hidden desktop panel renders cards too; scope to the open sheet.
    const cards = sheet.getByTestId('suggested-action-card')
    await expect(cards).toHaveCount(2)
    await expect(cards.nth(0)).toBeVisible()
    await expect(cards.nth(1)).toBeVisible()

    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(docWidth).toBeLessThanOrEqual(VIEWPORT.width)

    const group = sheet.getByTestId('suggested-actions-group')
    const { scrollWidth, clientWidth } = await group.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

    const buttons = cards.getByRole('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      if (!(await button.isVisible())) continue
      const box = await button.boundingBox()
      const name = (await button.getAttribute('aria-label')) ?? (await button.textContent())
      expect(box, `button ${name} has no box`).not.toBeNull()
      expect(box!.width, `button ${name} width`).toBeGreaterThanOrEqual(40)
      expect(box!.height, `button ${name} height`).toBeGreaterThanOrEqual(40)
    }

    const actionable = cards.filter({ has: page.getByRole('button', { name: 'Accept', exact: true }) })
    await expect(actionable.first()).toBeVisible()
    for (const name of ['Accept', 'Edit', 'Dismiss']) {
      const box = await actionable.first().getByRole('button', { name, exact: true }).boundingBox()
      expect(box, `${name} has no box`).not.toBeNull()
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(40)
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(40)
    }
  })

  test('the edit form and assignee picker fit the screen', async ({ page }) => {
    const sheet = await openActionsSheet(page)

    // The viewer is not the coach; this suggestion is assigned to the coachee only.
    const card = sheet.getByTestId('suggested-action-card').first()
    await card.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(card.getByRole('textbox')).toBeVisible()
    await card.getByRole('button', { name: 'Assignees' }).click()
    const popover = page
      .locator('[data-radix-popper-content-wrapper]')
      .filter({ has: page.getByRole('option') })
    await expect(popover).toBeVisible()

    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(docWidth).toBeLessThanOrEqual(VIEWPORT.width)

    const group = sheet.getByTestId('suggested-actions-group')
    const { scrollWidth, clientWidth } = await group.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

    const popoverBox = await popover.boundingBox()
    expect(popoverBox).not.toBeNull()
    expect(popoverBox!.x).toBeGreaterThanOrEqual(0)
    expect(popoverBox!.x + popoverBox!.width).toBeLessThanOrEqual(VIEWPORT.width)

    for (const name of ['Accept', 'Save', 'Cancel']) {
      const box = await card.getByRole('button', { name, exact: true }).boundingBox()
      expect(box, `${name} has no box`).not.toBeNull()
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(40)
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(40)
    }
  })

  test('the duplicate marker and confirm row fit the screen', async ({ page }) => {
    const sheet = await openActionsSheet(page)

    // The first suggestion is a possible duplicate the viewer may act on.
    const card = sheet.getByTestId('suggested-action-card').first()
    await card.getByRole('button', { name: 'Accept', exact: true }).click()
    const row = card.getByTestId('suggested-action-duplicate-confirm')
    await expect(row).toBeVisible()

    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(docWidth).toBeLessThanOrEqual(VIEWPORT.width)

    const group = sheet.getByTestId('suggested-actions-group')
    const { scrollWidth, clientWidth } = await group.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

    const cardBox = await card.boundingBox()
    expect(cardBox).not.toBeNull()
    const within = (box: { x: number; width: number }) =>
      box.x >= cardBox!.x && box.x + box.width <= cardBox!.x + cardBox!.width

    for (const name of ['Add anyway', 'Keep existing', 'Cancel']) {
      const box = await row.getByRole('button', { name }).boundingBox()
      expect(box, `${name} has no box`).not.toBeNull()
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(40)
      expect(within(box!), `${name} lies within the card`).toBe(true)
    }

    const markerBox = await card.getByRole('button', { name: /Possible duplicate/ }).boundingBox()
    expect(markerBox).not.toBeNull()
    expect(within(markerBox!), 'marker lies within the card').toBe(true)
    expect(markerBox!.y).toBeGreaterThanOrEqual(cardBox!.y)
    expect(markerBox!.y + markerBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height)
  })

  test('the dismissed section fits the screen and hides quotes', async ({ page }) => {
    const sheet = await openActionsSheet(page)

    const toggle = sheet.getByRole('button', { name: 'Dismissed (2)' })
    await toggle.click()
    const rows = sheet.getByTestId('dismissed-suggestion')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toBeVisible()

    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(docWidth).toBeLessThanOrEqual(VIEWPORT.width)

    const panel = sheet.getByTestId('session-section-content')
    const { scrollWidth, clientWidth } = await panel.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

    const toggleBox = await toggle.boundingBox()
    expect(toggleBox).not.toBeNull()
    expect(toggleBox!.height, 'Dismissed trigger height').toBeGreaterThanOrEqual(40)

    const restores = rows.getByRole('button', { name: /Restore/ })
    const count = await restores.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const button = restores.nth(i)
      if (!(await button.isVisible())) continue
      const box = await button.boundingBox()
      expect(box, `Restore ${i} has no box`).not.toBeNull()
      expect(box!.height, `Restore ${i} height`).toBeGreaterThanOrEqual(40)
    }

    for (const d of DISMISSED) {
      await expect(rows.getByText(d.quote, { exact: false })).toBeHidden()
    }
  })
})
