import { test, expect, type Locator, type Page, type Route } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
  MOCK_USER_ID,
  SINGLE_RELATIONSHIP,
} from './helpers'

// Reviewing suggested actions end to end against a stateful mocked backend.

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' })

const SESSION_ID = 'session-review-1'
const DESKTOP = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }
const NOON = '2026-10-11T12:00:00Z'
const NEXT_SESSION = '2026-10-18T12:00:00Z'

const BASE_RELATIONSHIP = SINGLE_RELATIONSHIP[0]
type Relationship = typeof BASE_RELATIONSHIP
const AS_COACH: Relationship = { ...BASE_RELATIONSHIP, coach_id: MOCK_USER_ID }
const AS_COACHEE: Relationship = { ...BASE_RELATIONSHIP, coachee_id: MOCK_USER_ID }

const MOCK_SESSION = {
  id: SESSION_ID,
  coaching_relationship_id: BASE_RELATIONSHIP.id,
  date: NOON,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

interface ActionWire {
  id: string
  coaching_session_id: string
  goal_id: string | null
  body: string
  user_id: string
  status: string
  status_changed_at: string
  due_by: string | null
  created_at: string
  updated_at: string
  assignee_ids: string[]
}

interface SuggestionWire {
  id: string
  coaching_session_id: string
  proposal: ActionWire & { due_phrase: string | null }
  quote: string
  segment: { id: string; start_ms: number; speaker_role: string; speaker_label: string }
  duplicate_of: { action_id: string; body: string } | null
  default_due: { at: string; source: string }
  created_at: string
  resolved_by: string | null
  resolved_at: string | null
}

interface EditsWire {
  body: string
  due_by: string | null
  assignee_ids: string[]
  goal_id: string | null
}

interface Mutation {
  method: string
  path: string
  body: string | null
}

interface Seed {
  pending: SuggestionWire[]
  dismissed: SuggestionWire[]
}

interface Backend {
  pending: SuggestionWire[]
  dismissed: SuggestionWire[]
  actions: ActionWire[]
  mutations: Mutation[]
  /** Puts the seed back and forgets every recorded mutation. */
  reset: () => void
}

// Minutes keep the list oldest first, as the backend returns it.
function suggestion(
  id: string,
  minute: number,
  body: string,
  assigneeIds: string[],
  duplicateOf: { action_id: string; body: string } | null = null
): SuggestionWire {
  const at = `2026-10-11T12:${String(minute).padStart(2, '0')}:00Z`
  return {
    id,
    coaching_session_id: SESSION_ID,
    proposal: {
      id: '00000000-0000-0000-0000-000000000000',
      coaching_session_id: SESSION_ID,
      goal_id: null,
      body,
      user_id: BASE_RELATIONSHIP.coach_id,
      status: 'NotStarted',
      status_changed_at: at,
      due_by: null,
      created_at: at,
      updated_at: at,
      assignee_ids: assigneeIds,
      due_phrase: null,
    },
    quote: `I will ${body.toLowerCase()}.`,
    segment: { id: `seg-${id}`, start_ms: 60000 * minute, speaker_role: 'coachee', speaker_label: 'Jane Smith' },
    duplicate_of: duplicateOf,
    default_due: { at: NEXT_SESSION, source: 'next_session' },
    created_at: at,
    resolved_by: null,
    resolved_at: null,
  }
}

const COACH = BASE_RELATIONSHIP.coach_id
const COACHEE = BASE_RELATIONSHIP.coachee_id

const PLAIN = 'Book a call with Dana'
const DUPLICATE = 'Send the Q4 hiring plan to Dana'
const SHARED = 'Update the onboarding checklist'
const EDITED = 'Write an onboarding checklist for interns'
const DISMISSED = 'Review the interview rubric'

const GOAL = {
  id: 'goal-leadership',
  coaching_relationship_id: BASE_RELATIONSHIP.id,
  created_in_session_id: SESSION_ID,
  user_id: MOCK_USER_ID,
  title: 'Grow as a leader',
  body: 'Delegate more and coach the team',
  status: 'InProgress',
  status_changed_at: '2026-10-01T12:00:00Z',
  completed_at: null,
  target_date: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

async function mockSessionGoal(page: Page): Promise<void> {
  await page.route(`**/coaching_sessions/${SESSION_ID}/goals`, (route) => route.fulfill(json([GOAL])))
  await page.route('**/goals/*/progress', (route) =>
    route.fulfill(
      json({
        actions_completed: 0,
        actions_total: 1,
        linked_coaching_session_count: 1,
        progress: 'NeedsAttention',
        last_coaching_session_date: null,
        next_action_due: null,
      })
    )
  )
}

const COACH_SEED: Seed = {
  pending: [
    suggestion('sug-plain', 1, PLAIN, [COACHEE]),
    suggestion('sug-dup', 2, DUPLICATE, [COACHEE], {
      action_id: 'act-existing',
      body: 'Send Dana the Q4 hiring plan',
    }),
    suggestion('sug-shared', 3, SHARED, [MOCK_USER_ID, COACHEE]),
  ],
  dismissed: [],
}

const COACH_ONLY = 'Send Jane the article on feedback'
const OWN = 'Clean up the shared drive'

const COACHEE_SEED: Seed = {
  pending: [
    suggestion('sug-coach-only', 1, COACH_ONLY, [COACH]),
    suggestion('sug-own', 2, OWN, [MOCK_USER_ID]),
  ],
  dismissed: [],
}

const json = (data: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ status_code: status, data }),
})

function resolve(s: SuggestionWire): SuggestionWire {
  return { ...s, resolved_by: MOCK_USER_ID, resolved_at: '2026-10-11T12:30:00Z' }
}

function unresolve(s: SuggestionWire): SuggestionWire {
  return { ...s, resolved_by: null, resolved_at: null }
}

function byCreated(a: SuggestionWire, b: SuggestionWire): number {
  return a.created_at.localeCompare(b.created_at)
}

function actionFrom(s: SuggestionWire, edits: EditsWire | null): ActionWire {
  return {
    ...s.proposal,
    id: `act-${s.id}`,
    body: edits?.body ?? s.proposal.body,
    due_by: edits ? edits.due_by : s.proposal.due_by,
    assignee_ids: edits?.assignee_ids ?? s.proposal.assignee_ids,
    goal_id: edits ? edits.goal_id : s.proposal.goal_id,
    user_id: MOCK_USER_ID,
    created_at: '2026-10-11T12:45:00Z',
    updated_at: '2026-10-11T12:45:00Z',
  }
}

function take(list: SuggestionWire[], id: string): SuggestionWire | undefined {
  const index = list.findIndex((s) => s.id === id)
  return index === -1 ? undefined : list.splice(index, 1)[0]
}

async function handleSuggestions(route: Route, backend: Backend): Promise<void> {
  const request = route.request()
  const url = new URL(request.url())
  if (request.method() === 'GET') {
    const dismissed = url.searchParams.get('status') === 'dismissed'
    return route.fulfill(json(dismissed ? backend.dismissed : backend.pending))
  }

  const body = request.postData()
  backend.mutations.push({ method: request.method(), path: url.pathname, body })
  const [id, verb] = url.pathname.split('/transcript_suggestions/')[1].split('/')
  const edits = body ? (JSON.parse(body) as EditsWire) : null

  if (verb === 'restore') {
    const restored = take(backend.dismissed, id)
    if (!restored) return route.fulfill(json(null, 404))
    backend.pending = [...backend.pending, unresolve(restored)].sort(byCreated)
    return route.fulfill({ status: 204 })
  }

  const target = take(backend.pending, id)
  if (!target) return route.fulfill(json(null, 409))
  if (verb === 'dismiss') {
    backend.dismissed = [...backend.dismissed, resolve(target)].sort(byCreated)
    return route.fulfill({ status: 204 })
  }
  const created = actionFrom(target, edits)
  backend.actions = [...backend.actions, created]
  return route.fulfill(json(created, 201))
}

async function mockBackend(page: Page, relationship: Relationship, seed: Seed): Promise<Backend> {
  const backend: Backend = {
    pending: [],
    dismissed: [],
    actions: [],
    mutations: [],
    reset() {
      backend.pending = structuredClone(seed.pending)
      backend.dismissed = structuredClone(seed.dismissed)
      backend.actions = []
      backend.mutations.length = 0
    },
  }
  backend.reset()

  await page.addInitScript((relId) => {
    sessionStorage.setItem(
      'coaching-relationship-state-store',
      JSON.stringify({ state: { currentCoachingRelationshipId: relId }, version: 1 })
    )
  }, relationship.id)
  await mockCommonApiRoutes(page, {
    relationships: [relationship],
    coachingSessions: [MOCK_SESSION],
  })
  // Registered after the common routes so these win.
  await page.route('**/coaching_relationships/*', (route) => route.fulfill(json(relationship)))
  await page.route(`**/users/${MOCK_USER_ID}/actions**`, (route) => {
    const forSession = route.request().url().includes(`coaching_session_id=${SESSION_ID}`)
    return route.fulfill(json(forSession ? backend.actions : []))
  })
  await page.route('**/coaching_sessions/*/transcript_suggestions**', (route) =>
    handleSuggestions(route, backend)
  )
  return backend
}

const sent = (backend: Backend, method: string, suffix: string): Mutation[] =>
  backend.mutations.filter((m) => m.method === method && m.path.endsWith(suffix))

const cardWith = (scope: Locator, text: string): Locator =>
  scope.getByTestId('suggested-action-card').filter({ hasText: text })

const editingCard = (scope: Locator, page: Page): Locator =>
  scope.getByTestId('suggested-action-card').filter({ has: page.getByRole('textbox') })

async function openActionsPanel(page: Page): Promise<Locator> {
  await page.goto(`/coaching-sessions/${SESSION_ID}`)
  const panel = page.locator('div.hidden.md\\:block')
  // The coachee's Topics section adds a Priority combobox after the section picker.
  await panel.getByRole('combobox').first().click()
  await page.getByRole('option', { name: /Actions/ }).click()
  await expect(panel.getByTestId('suggested-actions-group')).toBeVisible()
  return panel
}

// Opens the panel sheet and switches it to Actions as a user would.
async function openActionsSheet(page: Page): Promise<Locator> {
  await page.goto(`/coaching-sessions/${SESSION_ID}`)
  await page.locator('div.md\\:hidden').getByRole('button').first().click()
  // The Radix popover is also a dialog; the sheet is the one with the panel.
  const sheet = page.getByRole('dialog').filter({ has: page.getByRole('combobox') })
  await sheet.getByRole('combobox').click()
  await page.getByRole('option', { name: /Actions/ }).click()
  return sheet
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(PHONE.width)
}

test.describe('Coach reviews suggested actions', () => {
  test.use({ viewport: DESKTOP })

  let backend: Backend

  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
    backend = await mockBackend(page, AS_COACH, COACH_SEED)
  })

  test('accept adds the action and rings it', async ({ page }) => {
    const panel = await openActionsPanel(page)

    await cardWith(panel, PLAIN).getByRole('button', { name: 'Accept', exact: true }).click()

    const created = panel
      .getByTestId('session-section-content')
      .locator('div.flip-card-container', { hasText: PLAIN })
    await expect(created).toBeVisible()
    await expect(created.locator('.flip-card-front')).toHaveClass(/ring-2/)
    await expect(cardWith(panel, PLAIN)).toHaveCount(0)

    const accepts = sent(backend, 'POST', '/sug-plain/accept')
    expect(accepts).toHaveLength(1)
    expect(accepts[0].body ?? '').toBe('')
    expect(sent(backend, 'POST', '/accept')).toHaveLength(1)
  })

  test('edit then cancel sends nothing', async ({ page }) => {
    const panel = await openActionsPanel(page)

    await cardWith(panel, SHARED).getByRole('button', { name: 'Edit', exact: true }).click()
    const form = editingCard(panel, page)
    await form.getByRole('textbox').fill(EDITED)
    await expect(form.getByRole('button', { name: 'Save' })).toHaveCount(0)
    await form.getByRole('button', { name: 'Cancel', exact: true }).click()

    await expect(editingCard(panel, page)).toHaveCount(0)
    const card = cardWith(panel, SHARED)
    await expect(card.getByTestId('suggested-action-body')).toBeVisible()
    await expect(card.getByTestId('suggested-action-body')).toHaveText(SHARED)
    await expect(cardWith(panel, EDITED)).toHaveCount(0)

    expect(sent(backend, 'PUT', '/sug-shared')).toHaveLength(0)
    expect(sent(backend, 'POST', '/accept')).toHaveLength(0)
  })

  test('edit then accept adds the edited action in one step', async ({ page }) => {
    const panel = await openActionsPanel(page)

    await cardWith(panel, SHARED).getByRole('button', { name: 'Edit', exact: true }).click()
    const form = editingCard(panel, page)
    await form.getByRole('textbox').fill(EDITED)
    await form.getByRole('button', { name: 'Accept', exact: true }).click()

    const created = panel
      .getByTestId('session-section-content')
      .locator('div.flip-card-container', { hasText: EDITED })
    await expect(created).toBeVisible()
    await expect(created.locator('.flip-card-front')).toHaveClass(/ring-2/)
    await expect(cardWith(panel, SHARED)).toHaveCount(0)
    await expect(editingCard(panel, page)).toHaveCount(0)

    const accepts = sent(backend, 'POST', '/sug-shared/accept')
    expect(accepts).toHaveLength(1)
    expect((JSON.parse(accepts[0].body ?? '{}') as EditsWire).body).toBe(EDITED)
    expect(sent(backend, 'POST', '/accept')).toHaveLength(1)
    expect(sent(backend, 'PUT', '/sug-shared')).toHaveLength(0)
  })

  test('edit, link a goal, accept', async ({ page }) => {
    await mockSessionGoal(page)
    const panel = await openActionsPanel(page)

    await cardWith(panel, SHARED).getByRole('button', { name: 'Edit', exact: true }).click()
    const form = editingCard(panel, page)
    await form.getByText('Linked goal').locator('xpath=..').getByRole('button').click()
    await page.getByRole('option', { name: GOAL.title }).click()
    await form.getByRole('button', { name: 'Accept', exact: true }).click()

    await expect(cardWith(panel, SHARED)).toHaveCount(0)
    const accepts = sent(backend, 'POST', '/sug-shared/accept')
    expect(accepts).toHaveLength(1)
    expect((JSON.parse(accepts[0].body ?? '{}') as EditsWire).goal_id).toBe(GOAL.id)
    expect(sent(backend, 'POST', '/accept')).toHaveLength(1)
  })

  test('dismiss offers an undo that restores the card', async ({ page }) => {
    const panel = await openActionsPanel(page)

    await cardWith(panel, PLAIN).getByRole('button', { name: 'Dismiss', exact: true }).click()
    await expect(page.getByText(`Dismissed "${PLAIN}"`)).toBeVisible()
    expect(sent(backend, 'POST', '/sug-plain/dismiss')).toHaveLength(1)

    await page.getByRole('button', { name: 'Undo' }).click()

    await expect(cardWith(panel, PLAIN)).toBeVisible()
    expect(sent(backend, 'POST', '/sug-plain/restore')).toHaveLength(1)
  })

  test('a possible duplicate asks before adding or keeping the existing action', async ({ page }) => {
    let panel = await openActionsPanel(page)

    await cardWith(panel, DUPLICATE).getByRole('button', { name: 'Accept', exact: true }).click()
    const confirm = cardWith(panel, DUPLICATE).getByTestId('suggested-action-duplicate-confirm')
    await expect(confirm).toContainText('This looks like an action you already have:')
    expect(sent(backend, 'POST', '/accept')).toHaveLength(0)

    await confirm.getByRole('button', { name: 'Add anyway' }).click()
    await expect(cardWith(panel, DUPLICATE)).toHaveCount(0)
    expect(sent(backend, 'POST', '/sug-dup/accept')).toHaveLength(1)
    expect(sent(backend, 'POST', '/accept')).toHaveLength(1)

    backend.reset()
    panel = await openActionsPanel(page)

    await cardWith(panel, DUPLICATE).getByRole('button', { name: 'Accept', exact: true }).click()
    await cardWith(panel, DUPLICATE)
      .getByTestId('suggested-action-duplicate-confirm')
      .getByRole('button', { name: 'Keep existing' })
      .click()
    await expect(cardWith(panel, DUPLICATE)).toHaveCount(0)
    expect(sent(backend, 'POST', '/sug-dup/dismiss')).toHaveLength(1)
    expect(sent(backend, 'POST', '/accept')).toHaveLength(0)
  })

  test('a dismissed suggestion is listed and can be restored', async ({ page }) => {
    const panel = await openActionsPanel(page)

    await cardWith(panel, PLAIN).getByRole('button', { name: 'Dismiss', exact: true }).click()
    const toggle = panel.getByRole('button', { name: 'Dismissed (1)' })
    await toggle.click()

    const row = panel.getByTestId('dismissed-suggestion').filter({ hasText: PLAIN })
    await expect(row).toContainText('Dismissed by you')
    await row.getByRole('button', { name: 'Restore' }).click()

    await expect(cardWith(panel.getByTestId('suggested-actions-group'), PLAIN)).toBeVisible()
    expect(sent(backend, 'POST', '/sug-plain/restore')).toHaveLength(1)
  })

  test('every suggestion control has an accessible name', async ({ page }) => {
    backend.dismissed = [resolve(suggestion('sug-dismissed', 4, DISMISSED, [COACHEE]))]
    const panel = await openActionsPanel(page)

    const toggle = panel.getByRole('button', { name: 'Dismissed (1)' })
    await toggle.click()
    await expect(panel.getByTestId('dismissed-suggestion')).toBeVisible()

    const group = panel.getByTestId('suggested-actions-group')
    const dismissedSection = toggle.locator('xpath=..')
    const buttons = [
      ...(await group.getByRole('button').all()),
      ...(await dismissedSection.getByRole('button').all()),
    ]
    expect(buttons.length).toBeGreaterThan(10)
    for (const button of buttons) {
      await expect(button).toHaveAccessibleName(/\S/)
    }
  })
})

test.describe('Coachee reviews suggested actions', () => {
  test.use({ viewport: DESKTOP })

  let backend: Backend

  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
    backend = await mockBackend(page, AS_COACHEE, COACHEE_SEED)
  })

  test('a coach-only suggestion is read-only; their own is actionable', async ({ page }) => {
    const panel = await openActionsPanel(page)

    const coachOnly = cardWith(panel, COACH_ONLY)
    await expect(coachOnly.getByTestId('suggested-action-lock-note')).toHaveText(
      'Only John can accept or edit this action.'
    )
    for (const name of ['Accept', 'Dismiss', 'Edit']) {
      await expect(coachOnly.getByRole('button', { name })).toHaveCount(0)
    }

    const own = cardWith(panel, OWN)
    for (const name of ['Accept', 'Dismiss', 'Edit']) {
      await expect(own.getByRole('button', { name, exact: true })).toBeVisible()
    }
    await expect(own.getByTestId('suggested-action-lock-note')).toHaveCount(0)
  })

  test('the coachee cannot assign the coach', async ({ page }) => {
    const panel = await openActionsPanel(page)

    await cardWith(panel, OWN).getByRole('button', { name: 'Edit', exact: true }).click()
    const form = editingCard(panel, page)
    await form.getByRole('button', { name: 'Assignees' }).click()

    const coachOption = page.getByRole('option', { name: /John Doe/ })
    await expect(coachOption).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByText('Only your coach can assign an action to themselves.')).toBeVisible()
    // Force past Playwright's enabled check to prove the click itself is ignored.
    await coachOption.click({ force: true })
    await expect(coachOption).toHaveAttribute('aria-selected', 'false')

    await page.keyboard.press('Escape')
    await form.getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(cardWith(panel, OWN)).toHaveCount(0)

    const accepts = sent(backend, 'POST', '/sug-own/accept')
    expect(accepts).toHaveLength(1)
    expect((JSON.parse(accepts[0].body ?? '{}') as EditsWire).assignee_ids).not.toContain(COACH)
  })
})

test.describe('Coach reviews suggested actions on a phone', () => {
  test.use({ viewport: PHONE })

  test('accept, dismiss and edit without horizontal scroll', async ({ page, context }) => {
    await setupAuthentication(page, context)
    const backend = await mockBackend(page, AS_COACH, COACH_SEED)
    const sheet = await openActionsSheet(page)
    const cards = sheet.getByTestId('suggested-action-card')
    await expect(cards).toHaveCount(3)
    await expectNoHorizontalScroll(page)

    await cardWith(sheet, PLAIN).getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(cards).toHaveCount(2)
    await expectNoHorizontalScroll(page)

    await cardWith(sheet, DUPLICATE).getByRole('button', { name: 'Dismiss', exact: true }).click()
    await expect(cards).toHaveCount(1)
    await expectNoHorizontalScroll(page)

    await cardWith(sheet, SHARED).getByRole('button', { name: 'Edit', exact: true }).click()
    const form = editingCard(sheet, page)
    await form.getByRole('textbox').fill(EDITED)
    await expectNoHorizontalScroll(page)
    await form.getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(cards).toHaveCount(0)
    await expect(sheet.locator('div.flip-card-container', { hasText: EDITED })).toBeVisible()
    await expectNoHorizontalScroll(page)

    expect(sent(backend, 'POST', '/sug-plain/accept')).toHaveLength(1)
    expect(sent(backend, 'POST', '/sug-dup/dismiss')).toHaveLength(1)
    expect(sent(backend, 'POST', '/sug-shared/accept')).toHaveLength(1)
    expect(sent(backend, 'PUT', '/sug-shared')).toHaveLength(0)
  })
})

test.describe('Suggested actions in dark mode', () => {
  test.use({ viewport: DESKTOP, colorScheme: 'dark' })

  test('the lock note pairs its icon with text', async ({ page, context }) => {
    await setupAuthentication(page, context)
    await mockBackend(page, AS_COACHEE, COACHEE_SEED)
    const panel = await openActionsPanel(page)
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)

    const coachOnly = cardWith(panel, COACH_ONLY)
    await expect(coachOnly).toBeVisible()
    const note = coachOnly.getByTestId('suggested-action-lock-note')
    await expect(note.locator('svg')).toHaveCount(1)
    await expect(note).toHaveText('Only John can accept or edit this action.')
  })
})
