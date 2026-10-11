import { test, expect } from '@playwright/test'
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

function wireSuggestion(id: string, body: string, quote: string, assigneeIds: string[]) {
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
    duplicate_of: null,
    default_due: { at: '2026-10-18T16:30:00Z', source: 'next_session' },
    created_at: '2026-10-11T17:05:00Z',
  }
}

const SUGGESTIONS = [
  wireSuggestion(
    'sug-long',
    'Draft the quarterly hiring plan with headcount, budget, interview loops and a timeline, then share it with Dana and the leadership team before the offsite so everyone can comment ahead of time',
    `I'll write it up in our ${'supercalifragilisticexpialidocious'.repeat(3)} planning doc and send it over.`,
    [RELATIONSHIP.coachee_id]
  ),
  wireSuggestion(
    'sug-short',
    'Book a call with Dana',
    'Let me book a call with Dana.',
    [RELATIONSHIP.coach_id, RELATIONSHIP.coachee_id]
  ),
]

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
  })

  test('cards fit the screen and keep 40px touch targets', async ({ page }) => {
    await page.goto(`/coaching-sessions/${SESSION_ID}`)

    // Open the panel sheet, then switch it to Actions as a user would.
    const mobilePanel = page.locator('div.md\\:hidden')
    await mobilePanel.getByRole('button').first().click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('combobox').click()
    await page.getByRole('option', { name: /Actions/ }).click()

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
  })
})
