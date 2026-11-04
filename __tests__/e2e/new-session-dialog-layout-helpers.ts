import type { BrowserContext, Page, Route } from '@playwright/test'
import { AUTH_STORE_STATE, MOCK_USER_ID, SINGLE_RELATIONSHIP, mockCommonApiRoutes, setupAuthentication } from './helpers'

// ─── Clock and people ────────────────────────────────────────────────

/** Monday, November 16, 2026, 8:00 AM in Chicago (CST, UTC-6). */
export const NOW = '2026-11-16T14:00:00Z'

const COACH = { id: MOCK_USER_ID, first_name: 'Test', last_name: 'User', display_name: 'Test User' }

const PEOPLE = [
  ['rel-max', 'max', 'Maximiliana', 'Montgomery-Fitzgerald'],
  ['rel-bart', 'bart', 'Bartholomew', 'Oyelaran-Castellanos'],
  ['rel-alex', 'alex', 'Alex', 'Chen'],
  ['rel-daniel', 'daniel', 'Daniel', 'Wu'],
  ['rel-ehab', 'ehab', 'Ehab', 'Badawi'],
  ['rel-lena', 'lena', 'Lena', 'Torres'],
  ['rel-priya', 'priya', 'Priya', 'Raman'],
  ['rel-sarah', 'sarah', 'Sarah', 'Kim'],
] as const

const COACHED = PEOPLE.map(([id, coacheeId, first, last]) => ({
  ...SINGLE_RELATIONSHIP[0],
  id,
  coach_id: MOCK_USER_ID,
  coachee_id: coacheeId,
  coach_first_name: COACH.first_name,
  coach_last_name: COACH.last_name,
  coachee_first_name: first,
  coachee_last_name: last,
}))

/** The user is the coachee here, so a clash with this session can't be moved. */
const MY_COACH_RELATIONSHIP = {
  ...SINGLE_RELATIONSHIP[0],
  id: 'rel-my-coach',
  coach_id: 'constantine',
  coachee_id: MOCK_USER_ID,
  coach_first_name: 'Constantine',
  coach_last_name: 'Abernathy-Whitfield',
  coachee_first_name: COACH.first_name,
  coachee_last_name: COACH.last_name,
}

export const RELATIONSHIPS = [...COACHED, MY_COACH_RELATIONSHIP]

// ─── Sessions ────────────────────────────────────────────────────────

export const EHAB_SERIES_ID = 'series-ehab'

type Relationship = (typeof RELATIONSHIPS)[number]

const relationship = (id: string): Relationship => RELATIONSHIPS.find((rel) => rel.id === id)!

const user = (id: string, first: string, last: string) => ({
  id,
  first_name: first,
  last_name: last,
  display_name: `${first} ${last}`,
})

/** `date` is naive UTC, as the backend sends it. */
function session(id: string, relId: string, date: string, seriesId: string | null = null) {
  const rel = relationship(relId)
  return {
    id,
    coaching_relationship_id: relId,
    date,
    duration_minutes: 60,
    title: null,
    display_title: null,
    coaching_session_series_id: seriesId,
    series: seriesId ? { id: seriesId, last_session_date: '2027-01-18T20:00:00' } : null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    relationship: rel,
    coach: user(rel.coach_id, rel.coach_first_name, rel.coach_last_name),
    coachee: user(rel.coachee_id, rel.coachee_first_name, rel.coachee_last_name),
  }
}

export type MockSession = ReturnType<typeof session>

/** Ehab's weekly series: Mondays at 2:00 PM, Nov 2 through Jan 18. */
const EHAB_SERIES_SESSIONS = Array.from({ length: 12 }, (_, week) => {
  const day = new Date(Date.UTC(2026, 10, 2 + week * 7, 20))
  return session(`ehab-${week + 1}`, 'rel-ehab', day.toISOString().slice(0, 19), EHAB_SERIES_ID)
})

/** Today at 2:00 PM, in the series. */
export const EHAB_TODAY = EHAB_SERIES_SESSIONS[2]
/** Today at 11:00 AM, a one-off. */
export const ALEX_TODAY = session('alex-today', 'rel-alex', '2026-11-16T17:00:00')

export const SESSIONS: MockSession[] = [
  // History: two of each give Maximiliana (Mon 10:00), Bartholomew (Tue 11:00),
  // Daniel (Thu 1:00 PM), Lena (Fri 3:00 PM) and Priya (Wed 4:00 PM) a usual slot.
  session('max-h1', 'rel-max', '2026-11-02T16:00:00'),
  session('max-h2', 'rel-max', '2026-11-09T16:00:00'),
  session('bart-h1', 'rel-bart', '2026-11-03T17:00:00'),
  session('bart-h2', 'rel-bart', '2026-11-10T17:00:00'),
  session('daniel-h1', 'rel-daniel', '2026-11-05T19:00:00'),
  session('daniel-h2', 'rel-daniel', '2026-11-12T19:00:00'),
  session('lena-h1', 'rel-lena', '2026-11-06T21:00:00'),
  session('lena-h2', 'rel-lena', '2026-11-13T21:00:00'),
  session('priya-h1', 'rel-priya', '2026-11-04T22:00:00'),
  session('priya-h2', 'rel-priya', '2026-11-11T22:00:00'),
  ...EHAB_SERIES_SESSIONS,
  ALEX_TODAY,
  // Wednesday Nov 18: seven sessions, 9 AM to 5 PM with only noon free.
  session('wed-max', 'rel-max', '2026-11-18T15:00:00'),
  session('wed-bart', 'rel-bart', '2026-11-18T16:00:00'),
  session('wed-alex', 'rel-alex', '2026-11-18T17:00:00'),
  session('wed-daniel', 'rel-daniel', '2026-11-18T19:00:00'),
  session('wed-lena', 'rel-lena', '2026-11-18T20:00:00'),
  session('wed-priya', 'rel-priya', '2026-11-18T21:00:00'),
  session('wed-coach', 'rel-my-coach', '2026-11-18T22:00:00'),
  // Thursday Nov 19: 3 to 5 PM booked, so a 3 PM start has nothing free after it.
  session('thu-lena', 'rel-lena', '2026-11-19T21:00:00'),
  session('thu-priya', 'rel-priya', '2026-11-19T22:00:00'),
  // Friday Nov 20, 10 AM: the user's own coaching, unmovable.
  session('fri-coach', 'rel-my-coach', '2026-11-20T16:00:00'),
  // Sunday Nov 29: a busy day in the Sunday column.
  session('sun-max', 'rel-max', '2026-11-29T16:00:00'),
]

const EHAB_SERIES = {
  series: {
    id: EHAB_SERIES_ID,
    coaching_relationship_id: 'rel-ehab',
    rule: {
      start_at: EHAB_SERIES_SESSIONS[0].date,
      recurrence: { frequency: 'weekly', interval: 1, by_weekdays: ['Mon'], count: 12, until: null },
      duration_minutes: 60,
    },
    created_by_user_id: MOCK_USER_ID,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
  sessions: EHAB_SERIES_SESSIONS,
}

// ─── Routes ──────────────────────────────────────────────────────────

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })

const instant = (iso: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`).getTime()

function sessionsBetween(url: URL): MockSession[] {
  const from = url.searchParams.get('from_date') ?? '0000-01-01'
  const to = url.searchParams.get('to_date') ?? '9999-12-31'
  return SESSIONS.filter((s) => s.date.slice(0, 10) >= from && s.date.slice(0, 10) <= to).sort(
    (a, b) => instant(a.date) - instant(b.date)
  )
}

function nearestTo(url: URL): MockSession[] {
  const relId = url.searchParams.get('coaching_relationship_id') ?? ''
  const around = instant(url.searchParams.get('around') ?? NOW)
  const before = Number(url.searchParams.get('before') ?? '1')
  const after = Number(url.searchParams.get('after') ?? '1')
  const theirs = SESSIONS.filter((s) => s.coaching_relationship_id === relId).sort(
    (a, b) => instant(a.date) - instant(b.date)
  )
  const earlier = theirs.filter((s) => instant(s.date) < around).slice(-before)
  const later = theirs.filter((s) => instant(s.date) >= around).slice(0, after)
  return [...earlier, ...later].reverse()
}

/** How the relationships request answers. */
export type RelationshipsMode =
  | { kind: 'serve'; relationships: unknown[] }
  | { kind: 'fail' }
  | { kind: 'hold'; until: Promise<void> }

async function answerRelationships(route: Route, mode: RelationshipsMode) {
  switch (mode.kind) {
    case 'serve':
      return route.fulfill(json(mode.relationships))
    case 'fail':
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'internal' }) })
    case 'hold':
      await mode.until
      return route.fulfill(json(RELATIONSHIPS)).catch(() => {})
    default: {
      const _exhaustive: never = mode
      throw new Error(`Unhandled relationships mode: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

/** Read on every request, so a test can change the answer mid-run. */
export interface RelationshipsControl {
  mode: RelationshipsMode
}

export const serveAll = (): RelationshipsControl => ({ mode: { kind: 'serve', relationships: RELATIONSHIPS } })

export async function setupDashboard(page: Page, context: BrowserContext, relationships: RelationshipsControl) {
  await page.clock.setFixedTime(NOW)
  await setupAuthentication(page, context)
  await mockCommonApiRoutes(page, { relationships: RELATIONSHIPS })
  // Registered after mockCommonApiRoutes so these win (routes match LIFO).
  await page.route('**/coaching_relationships**', (route) => answerRelationships(route, relationships.mode))
  await page.route(
    (url) => url.pathname === `/users/${MOCK_USER_ID}/coaching_sessions`,
    (route) => route.fulfill(json(sessionsBetween(new URL(route.request().url()))))
  )
  await page.route(
    (url) => url.pathname === `/users/${MOCK_USER_ID}/coaching_sessions/nearest`,
    (route) => route.fulfill(json(nearestTo(new URL(route.request().url()))))
  )
  await page.route('**/coaching_sessions/counts**', (route) => route.fulfill(json({ counts: [] })))
  await page.route(
    (url) => url.pathname === `/coaching_session_series/${EHAB_SERIES_ID}`,
    (route) => route.fulfill(json(EHAB_SERIES))
  )
  await page.route(
    (url) => url.pathname === '/oauth/connections',
    (route) =>
      route.fulfill(
        json([{ id: 'oauth-1', user_id: MOCK_USER_ID, provider: 'google', external_email: 'test@example.com' }])
      )
  )
  await page.route(
    (url) => url.pathname === `/users/${MOCK_USER_ID}`,
    (route) =>
      route.fulfill(
        json({ ...AUTH_STORE_STATE.state.userSession, default_coaching_session_duration_minutes: 60 })
      )
  )
}

// ─── Layout measurement (runs in the page) ───────────────────────────

export interface LayoutReport {
  violations: string[]
  /** Text cut on purpose with `text-overflow: ellipsis`. */
  ellipsis: string[]
}

/**
 * Measures the open dialog against the layout rules. Self-contained: Playwright
 * serializes it into the page, so it may not reference anything outside.
 */
export function measureLayout({ desktop }: { desktop: boolean }): LayoutReport {
  const violations: string[] = []
  const ellipsis: string[] = []
  const T = 1
  const W = window.innerWidth
  const H = window.innerHeight
  const px = (n: number) => `${Math.round(n * 10) / 10}px`

  const nameOf = (el: Element): string => {
    const html = el as HTMLElement
    const labelled = (el as HTMLButtonElement).labels?.[0]?.textContent?.trim()
    const role = el.getAttribute('role')
    const label = el.getAttribute('aria-label') ?? labelled ?? (el as HTMLInputElement).placeholder ?? ''
    const kind = role ? `[role=${role}]` : ''
    const text = (html.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)
    const type = el instanceof HTMLInputElement ? `[type=${el.type}]` : ''
    return `<${el.tagName.toLowerCase()}${type}${kind}> "${label || text}"`
  }
  const style = (el: Element) => getComputedStyle(el)
  const clips = (el: Element) => {
    const s = style(el)
    return s.overflowX !== 'visible' || s.overflowY !== 'visible'
  }
  const scrollsY = (el: Element) => ['auto', 'scroll'].includes(style(el).overflowY)
  const isEllipsis = (el: Element) => style(el).textOverflow === 'ellipsis'
  const innerBox = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const left = r.left + el.clientLeft
    const top = r.top + el.clientTop
    return { left, top, right: left + el.clientWidth, bottom: top + el.clientHeight }
  }
  const overflowsX = (el: Element) => el.scrollWidth > el.clientWidth + T

  const dialog = document.querySelector<HTMLElement>('[role="dialog"][data-state="open"]')
  if (!dialog) return { violations: ['no open dialog'], ellipsis }
  const all = [dialog, ...Array.from(dialog.querySelectorAll<HTMLElement>('*'))]

  // The dialog fits.
  const d = dialog.getBoundingClientRect()
  if (d.left < -T || d.top < -T || d.right > W + T || d.bottom > H + T) {
    violations.push(
      `dialog box ${px(d.left)},${px(d.top)} → ${px(d.right)},${px(d.bottom)} is outside the ${W}×${H} viewport`
    )
  }
  if (desktop) {
    if (Math.abs(d.width - 860) > T) violations.push(`dialog is ${px(d.width)} wide, expected 860px`)
    const height = Math.min(560, H - 48)
    if (Math.abs(d.height - height) > T) violations.push(`dialog is ${px(d.height)} tall, expected ${height}px`)
  }

  // No sideways scroll.
  const doc = document.documentElement
  if (doc.scrollWidth > W) {
    const wide = Array.from(document.body.querySelectorAll('*'))
      .filter((el) => el.getBoundingClientRect().right > W + T)
      .filter((el) => !el.parentElement || el.parentElement.getBoundingClientRect().right <= W + T)
      .slice(0, 3)
      .map((el) => `${nameOf(el)} right ${px(el.getBoundingClientRect().right)}`)
    violations.push(`document scrollWidth ${doc.scrollWidth}px > innerWidth ${W}px (widest: ${wide.join('; ')})`)
  }
  for (const el of all) {
    if (!clips(el) || el.getBoundingClientRect().width <= 1 || !overflowsX(el)) continue
    if (isEllipsis(el)) continue
    violations.push(`${nameOf(el)} scrolls sideways: scrollWidth ${el.scrollWidth}px > clientWidth ${el.clientWidth}px`)
  }

  // Every control is reachable and not clipped; targets ≥44px below 900px.
  const controls = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button, a[href], input, [role="radio"], [role="spinbutton"], [role="searchbox"]'
    )
  ).filter((el) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    if (el instanceof HTMLInputElement && el.type === 'hidden') return false
    if (el.closest('[aria-hidden="true"]')) return false
    const s = style(el)
    return s.visibility !== 'hidden' && s.opacity !== '0' && s.display !== 'none'
  })
  for (const el of controls) {
    const r = el.getBoundingClientRect()
    const name = nameOf(el)
    if (r.left < d.left - T || r.right > d.right + T) {
      violations.push(
        `${name} spans ${px(r.left)}–${px(r.right)}, outside the dialog's ${px(d.left)}–${px(d.right)}`
      )
    }
    let scroller: HTMLElement | null = null
    for (let anc = el.parentElement; anc && dialog.contains(anc); anc = anc.parentElement) {
      if (!clips(anc)) continue
      const box = innerBox(anc)
      if (r.left < box.left - T || r.right > box.right + T) {
        violations.push(
          `${name} spans ${px(r.left)}–${px(r.right)}, clipped by ${nameOf(anc)} at ${px(box.left)}–${px(box.right)}`
        )
      }
      if (!scroller && scrollsY(anc)) scroller = anc
      if (anc === dialog) break
    }
    if (scroller) {
      const saved = scroller.scrollTop
      ;(el as HTMLElement & { scrollIntoViewIfNeeded: (center?: boolean) => void }).scrollIntoViewIfNeeded(false)
      const after = el.getBoundingClientRect()
      const box = innerBox(scroller)
      if (after.top < box.top - T || after.bottom > box.bottom + T) {
        violations.push(
          `${name} can't be scrolled fully into view: ${px(after.top)}–${px(after.bottom)} vs scroll body ${px(box.top)}–${px(box.bottom)}`
        )
      }
      scroller.scrollTop = saved
    } else if (r.top < d.top - T || r.bottom > d.bottom + T) {
      violations.push(`${name} spans ${px(r.top)}–${px(r.bottom)} vertically, outside the dialog's ${px(d.top)}–${px(d.bottom)}`)
    }
    if (!desktop) {
      const cell = el.parentElement
      const dayButton = el.closest('[data-testid="month-grid-days"]') !== null && cell !== null
      const column = dayButton ? cell!.getBoundingClientRect().width : Infinity
      if (dayButton && column < 44) {
        if (Math.abs(r.width - r.height) > T) {
          violations.push(`${name} in a ${px(column)} column is ${px(r.width)}×${px(r.height)}, not a circle`)
        }
      } else if (r.height < 44 - T) {
        violations.push(`${name} is ${px(r.height)} tall, under 44px`)
      }
    }
  }

  // The footer is visible and uncovered.
  const prev = dialog.querySelector('[aria-label="Previous step"]')
  const footer = prev?.parentElement
  if (!footer) {
    violations.push('no footer (the element holding the step arrows)')
  } else {
    const f = footer.getBoundingClientRect()
    if (f.left < -T || f.top < -T || f.right > W + T || f.bottom > H + T) {
      violations.push(`footer ${px(f.left)},${px(f.top)} → ${px(f.right)},${px(f.bottom)} is outside the ${W}×${H} viewport`)
    }
    const hit = document.elementFromPoint(f.left + f.width / 2, f.top + f.height / 2)
    if (!hit || !footer.contains(hit)) {
      violations.push(`footer is covered at its center by ${hit ? nameOf(hit) : 'nothing'}`)
    }
  }

  // Text isn't cut: rail values and person sub-lines wrap.
  const wrapping = dialog.querySelectorAll<HTMLElement>(
    'ol[aria-label="Steps"] li .line-clamp-2, button[aria-pressed] .line-clamp-2'
  )
  for (const el of Array.from(wrapping)) {
    if (overflowsX(el)) {
      violations.push(`${nameOf(el)} is cut: scrollWidth ${el.scrollWidth}px > clientWidth ${el.clientWidth}px`)
    }
  }

  // No horizontally clipped text: headings, the step subline, busy-list rows.
  const texts = dialog.querySelectorAll<HTMLElement>('h1, h2, h3, h2 + p, ul > li, ul > li > *')
  for (const el of Array.from(texts)) {
    if (!overflowsX(el) || isEllipsis(el)) continue
    violations.push(`${nameOf(el)} is clipped: scrollWidth ${el.scrollWidth}px > clientWidth ${el.clientWidth}px`)
  }
  for (const el of all) {
    if (isEllipsis(el) && overflowsX(el)) {
      ellipsis.push(`${nameOf(el)} (${el.scrollWidth}px in ${el.clientWidth}px)`)
    }
  }

  return { violations, ellipsis }
}

/** Waits out finite animations (open, fade) so boxes are measured at rest. */
export async function settle(page: Page) {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
    await Promise.all(finite.map((a) => a.finished.catch(() => undefined)))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}
