import { test, expect, type Page } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  SINGLE_RELATIONSHIP,
} from './helpers'

// A suggestion's quote link opens the transcript and centers its marked segment.

const SESSION_ID = 'session-jump-1'
const TRANSCRIPTION_ID = 'tx-jump-1'
const RELATIONSHIP = SINGLE_RELATIONSHIP[0]
const DESKTOP = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }

const MOCK_SESSION = {
  id: SESSION_ID,
  coaching_relationship_id: RELATIONSHIP.id,
  date: '2026-10-11T16:30:00Z',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}

const TRANSCRIPTION = {
  id: TRANSCRIPTION_ID,
  coaching_session_id: SESSION_ID,
  meeting_recording_id: 'rec-jump-1',
  external_id: 'ext-jump-1',
  status: 'completed',
  created_at: '2026-10-11T17:00:00Z',
  updated_at: '2026-10-11T17:00:00Z',
}

const segmentId = (n: number) => `seg-${n}`
const TARGET = segmentId(30)

const SEGMENTS = Array.from({ length: 40 }, (_, i) => {
  const n = i + 1
  const isCoach = n % 2 === 1
  return {
    id: segmentId(n),
    transcription_id: TRANSCRIPTION_ID,
    speaker_label: isCoach ? 'John Doe' : 'Jane Smith',
    speaker_user_id: isCoach ? RELATIONSHIP.coach_id : RELATIONSHIP.coachee_id,
    speaker_role: isCoach ? 'coach' : 'coachee',
    text:
      n === 30
        ? 'I should get time with Dana by end of next week.'
        : `Turn ${n} of the conversation, long enough to take up a couple of lines in the bubble.`,
    start_ms: n * 15000,
    end_ms: n * 15000 + 12000,
    created_at: '2026-10-11T17:00:00Z',
  }
})

const SUGGESTION = {
  id: 'sug-jump-1',
  coaching_session_id: SESSION_ID,
  proposal: {
    id: '00000000-0000-0000-0000-000000000000',
    coaching_session_id: SESSION_ID,
    goal_id: null,
    body: 'Book time with Dana',
    user_id: RELATIONSHIP.coach_id,
    status: 'NotStarted',
    status_changed_at: '2026-10-11T17:00:00Z',
    due_by: null,
    created_at: '2026-10-11T17:00:00Z',
    updated_at: '2026-10-11T17:00:00Z',
    assignee_ids: [RELATIONSHIP.coachee_id],
    due_phrase: 'by end of next week',
  },
  quote: 'I should get time with Dana by end of next week.',
  segment: { id: TARGET, start_ms: 30 * 15000, speaker_role: 'coachee', speaker_label: 'Jane Smith' },
  duplicate_of: null,
  default_due: { at: '2026-10-18T16:30:00Z', source: 'next_session' },
  created_at: '2026-10-11T17:05:00Z',
}

const json = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ status_code: 200, data }),
})

const markedTarget = (page: Page) =>
  page.locator(`[data-segment-id="${TARGET}"] [data-testid="transcript-jump-mark"]`)

test.describe('Jump from a suggestion to the transcript', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
    await page.addInitScript((relId) => {
      sessionStorage.setItem(
        'coaching-relationship-state-store',
        JSON.stringify({ state: { currentCoachingRelationshipId: relId }, version: 1 })
      )
    }, RELATIONSHIP.id)
    await mockCommonApiRoutes(page, { coachingSessions: [MOCK_SESSION] })
    await page.route('**/coaching_relationships/*', (route) => route.fulfill(json(RELATIONSHIP)))
    await page.route('**/coaching_sessions/*/meeting_recording', (route) =>
      route.fulfill(json(null))
    )
    await page.route('**/coaching_sessions/*/transcriptions', (route) =>
      route.fulfill(json(TRANSCRIPTION))
    )
    await page.route('**/transcriptions/*/transcription_segments**', (route) =>
      route.fulfill(json(SEGMENTS))
    )
    await page.route('**/coaching_sessions/*/transcript_suggestions**', (route) =>
      route.fulfill(json([SUGGESTION]))
    )
    // Registered last so it wins over the pending route above.
    await page.route('**/transcript_suggestions?*status=dismissed*', (route) =>
      route.fulfill(json([]))
    )
  })

  test('desktop: opens the transcript beside the expanded panel', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(`/coaching-sessions/${SESSION_ID}`)

    const panel = page.locator('div.hidden.md\\:block')
    await panel.getByRole('combobox').click()
    await page.getByRole('option', { name: /Actions/ }).click()
    const card = panel.getByTestId('suggested-action-card')
    await expect(card).toBeVisible()

    await card.getByRole('button', { name: /Show in transcript/ }).click()

    await expect(page).toHaveURL(/transcript=1/)
    await expect(markedTarget(page)).toBeVisible()
    await expect(markedTarget(page)).toBeInViewport()
    await expect(card).toBeVisible()
  })

  test('desktop: the jump scrolls only the transcript, never the page', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(`/coaching-sessions/${SESSION_ID}`)

    const panel = page.locator('div.hidden.md\\:block')
    await panel.getByRole('combobox').click()
    await page.getByRole('option', { name: /Actions/ }).click()
    const card = panel.getByTestId('suggested-action-card')
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: /Show in transcript/ }).click()
    await expect(markedTarget(page)).toBeInViewport()

    // The page's layout boxes clip their overflow but can still be scrolled from code,
    // which shifts the whole page up; only the transcript's own box may move.
    const scrolledAncestors = () =>
      page.evaluate(() => {
        const mark = document.querySelector('[data-testid="transcript-jump-mark"]')
        const moved: string[] = []
        let transcriptBoxSeen = false
        for (let n = mark?.parentElement ?? null; n; n = n.parentElement) {
          const scrolls = n.scrollHeight > n.clientHeight + 1
          if (scrolls && !transcriptBoxSeen && getComputedStyle(n).overflowY === 'auto') {
            transcriptBoxSeen = true
            continue
          }
          if (n.scrollTop !== 0) moved.push(`${n.tagName}.${n.className}`.slice(0, 80))
        }
        if (window.scrollY !== 0) moved.push('window')
        return moved
      })
    await expect.poll(scrolledAncestors).toEqual([])
  })

  test('desktop: reopening the transcript does not replay an earlier jump', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto(`/coaching-sessions/${SESSION_ID}`)
    const panel = page.locator('div.hidden.md\\:block')
    await panel.getByRole('combobox').click()
    await page.getByRole('option', { name: /Actions/ }).click()
    await panel
      .getByTestId('suggested-action-card')
      .getByRole('button', { name: /Show in transcript/ })
      .click()
    await expect(markedTarget(page)).toBeInViewport()

    await page.getByRole('button', { name: 'Close transcript' }).click()
    await expect(page.locator(`[data-segment-id="${TARGET}"]`)).toHaveCount(0)
    await page.getByRole('button', { name: 'Show transcript' }).click()

    await expect(page.locator(`[data-segment-id="${TARGET}"]`)).toHaveCount(1)
    await expect(page.getByTestId('transcript-jump-mark')).toHaveCount(0)
  })

  test('desktop: accepting beside the open transcript scrolls only the Actions panel', async ({
    page,
  }) => {
    const action = (id: string, body: string, created_at: string) => ({
      ...SUGGESTION.proposal,
      id,
      body,
      created_at,
      updated_at: created_at,
    })
    // Enough existing actions that the new one is out of view and the panel must scroll.
    const actions = Array.from({ length: 20 }, (_, i) =>
      action(`act-${i}`, `Existing action ${i + 1}`, '2026-10-11T16:00:00Z')
    )
    let accepted = false
    await page.route('**/users/*/actions**', (route) =>
      route.fulfill(json(route.request().url().includes(SESSION_ID) ? actions : []))
    )
    await page.route('**/coaching_sessions/*/transcript_suggestions**', (route) => {
      const url = route.request().url()
      if (route.request().method() === 'POST' && url.endsWith('/accept')) {
        accepted = true
        const created = action('act-new', SUGGESTION.proposal.body, '2026-10-11T18:00:00Z')
        actions.push(created)
        return route.fulfill({ ...json(created), status: 201 })
      }
      const dismissed = url.includes('status=dismissed')
      return route.fulfill(json(dismissed || accepted ? [] : [SUGGESTION]))
    })

    await page.setViewportSize(DESKTOP)
    await page.goto(`/coaching-sessions/${SESSION_ID}`)
    const panel = page.locator('div.hidden.md\\:block')
    await panel.getByRole('combobox').click()
    await page.getByRole('option', { name: /Actions/ }).click()
    const card = panel.getByTestId('suggested-action-card')
    // Opening the transcript beside the panel is what lets the clipped layout scroll.
    await card.getByRole('button', { name: /Show in transcript/ }).click()
    await expect(markedTarget(page)).toBeInViewport()

    await card.getByRole('button', { name: 'Accept', exact: true }).click()
    const created = panel.locator('div.flip-card-container', { hasText: SUGGESTION.proposal.body })
    await expect(created.locator('.flip-card-front')).toHaveClass(/ring-2/)
    await expect(created).toBeInViewport()

    // Only boxes that scroll on their own may move; clipped layout boxes and the window may not.
    const movedBoxes = () =>
      page.evaluate(() => {
        const moved: string[] = []
        for (const n of Array.from(document.querySelectorAll<HTMLElement>('body, body *'))) {
          if (n.scrollTop !== 0 && getComputedStyle(n).overflowY !== 'auto') {
            moved.push(`${n.tagName}.${n.className}`.slice(0, 80))
          }
        }
        if (window.scrollY !== 0) moved.push('window')
        return moved
      })
    await expect.poll(movedBoxes).toEqual([])
  })

  test('phone: closes the sheet and shows the marked segment', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto(`/coaching-sessions/${SESSION_ID}`)

    const mobilePanel = page.locator('div.md\\:hidden')
    await mobilePanel.getByRole('button').first().click()
    // The Radix popover is also a dialog; the sheet is the one with the panel.
    const sheet = page.getByRole('dialog').filter({ has: page.getByRole('combobox') })
    await sheet.getByRole('combobox').click()
    await page.getByRole('option', { name: /Actions/ }).click()

    await sheet
      .getByTestId('suggested-action-card')
      .getByRole('button', { name: /Show in transcript/ })
      .click()

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(markedTarget(page)).toBeInViewport()

    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(docWidth).toBeLessThanOrEqual(PHONE.width)
  })
})
