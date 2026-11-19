# Next session card and Today's Briefing panel

Living plan for `feat/next-session-card`. The design source is the Claude Design handoff (artboard 10a, Nov 19, 2026). The reviewed plan with mocks is at `.lavish/next-session-card/plan.html` (untracked).

## Goal

On the dashboard:

- Replace the "Welcome {name}!" header and Add New with a bordered **Today's Briefing** panel.
- Replace `UpcomingSessionCard` with a **Next session** card that looks ahead through the end of the current week.
- `GoalsOverviewCard` sits beside the new card and follows the same session.
- The week panel is unchanged.
- No backend changes.

## Phases

One phase is one commit. A fresh implementer builds each phase, and the overseer reviews it before the next one starts.

| # | Phase | Status |
|---|---|---|
| 1 | `lib/actions-due.ts` + `useActionsDue`; move the panel, `statusMeta` and `addContextToAction` onto it | done `27f32da5` |
| 2 | Week plumbing: `useWeekAt` export, `+Goal` include, `useNextSession`; goals card on it; `?actions=due` | done `bf7bde06` |
| 3 | Error tokens; `ui/errors/card-error.tsx`; goals card error on `CardError` | done `3442c823` |
| 4 | `lib/next-session-copy.ts` (headline, when line) | done `c4066b43` |
| 5 | `TodaysBriefingPanel`, `NextSessionCard` and its parts; swap them into the container; delete the old files; update existing test plans that name Add New, the Upcoming session card or "Schedule a coaching session" | done `9e44933f` |
| 5b | Real-backend fixes: the loading placeholder mirrors the populated layout (no panel jump); the goals card shows the week request's error with Try again | done `024ec93c` |
| 6 | Automated coverage of the manual plan: `__tests__/e2e/next-session-card.spec.ts`, a `?actions=due` case in `action-deep-link.spec.ts`, and the Due-tab parity integration test | done `38bf39b8` |
| 7 | `.claude/file-organization.md`, the CLAUDE.md row, the coding-standards pointer | done `c1d0d33f` |
| — | Overseer: real-backend check, light/dark/phone screenshots, draft PR | done: draft PR #574 |

Acceptance: `docs/test-plans/next_session_card_manual_testing.md`, written before the UI phases and kept static. The overseer runs it against the real backend before the draft PR.

Existing plans that phase 5 must update, because they name removed UI:
- `relationship_access_manual_testing.md`: DASH-01 to DASH-03, NEW-02.
- `new_session_dialog_manual_testing.md`: the entry point at the top and the Add New case.
- `design_system_manual_testing.md`: the "Add New" and "Schedule a coaching session" checks.
- `colleague_relationships_manual_testing.md`: COL-30, COL-30a.
- `week_grid_manual_testing.md`: Case 1.1 and the Part 9 regression line.

E2E specs phase 5 must update, because they use removed UI:
- `new-session-dialog-layout.spec.ts`: it opens the dialog through Add New; switch it to the week panel's Schedule session.
- `multi-org-live.spec.ts`: Add New.
- `multi-org-scoping-live.spec.ts`: the empty-state copy "No sessions scheduled for today". Live specs only run with `LIVE_E2E`, but they must still match the UI.

Baseline on main `b60f695` (Node 24): tsc clean, lint 0 errors / 85 warnings, unit tests 337 files / 3374 tests.

## Decisions

| Topic | Decision |
|---|---|
| Which session | The next non-past session through Sunday of the current week (Monday to Sunday in the user's zone). `selectNextUpcomingSession` over `useWeekSessions(useWeekAt(0))` |
| Shared selection | `useNextSession()` is read by both cards. When its request fails, the goals card shows "Couldn't load your goals" with Try again rather than the empty state. The goals card drops `useTodaysSessions`, and its organization id comes from `useCurrentOrganization` |
| Week request | `WEEK_INCLUDES` gains `Goal`. One request is shared by the week panel, the new card and the goals card |
| Actions due | One module, `lib/actions-due.ts`: `previousSessionOf`, `actionsDueAt` (the Due tab's set), `isOverdue`, `summarizeActionsDue`, and the session-list window constants. `useActionsDue` fetches with the same keys as the session page's Actions panel |
| Overdue | Open status (not started, in progress) and a due day before today in the user's zone. On hold, completed and won't do are never overdue. Applies to the card, `statusMeta` and the Actions page |
| Actions due count | Equals the Due tab, completed actions included. "{n} overdue" in warning when any are overdue, otherwise the count, "None" at zero |
| Goals row | `session.goals` count, which the backend caps at 3 in-progress goals. Accepted |
| Topics row | `session.topics` from the week request |
| Row links | Topics `?panel=topics`, Actions due `?panel=actions&actions=due`, Goals `?panel=goals`. Agreements from last session goes to the previous session with `?panel=agreements`, and the row is hidden when there is no previous session |
| Under way across midnight | The headline names the start day ("Yesterday") |
| Card styling | Populated, empty and loading are the hero card (`bg-hero-wash border-brand-border shadow-card`). Error is a plain `bg-card border` card |
| Loading | Static `bg-fill` bars inside the populated body's own layout, sharing the glance's row and header classes, so the common case keeps its height. No `animate-pulse` (style guide) |
| Error | `CardError({ title, onRetry })` in `ui/errors/`: a 36px `bg-error-tint` badge, an 18px `CircleAlert` in `text-error`, the title at 14/500, and a "Try again" fill pill. The goals card adopts it |
| Error tokens | `--error` `4.2 76.5% 40%` / dark `4.1 92.5% 68.8%`; `--error-tint` `6.3 82.6% 95.5%` / dark `4.8 38.5% 12.7%`; `--error-border` `4.9 69% 86.1%` / dark `4.1 46% 24.7%` |
| File placement | Flat in `ui/dashboard/` with a `next-session-*` prefix. Pure logic is a `src/lib/` root module. Nothing new goes in `lib/utils/`. Hook tests go in `__tests__/lib/hooks/` |
| Removed | `WelcomeHeader`, `DashboardHeader`, `AddNewButton`, `UpcomingSessionCard`, `UpcomingSessionCardEmpty`, and the card's Reschedule wiring |

## Copy

- "Today's Briefing", with the date as `formatWeekdayDate` gives it.
- "Next session".
- "Today with {first} at {h:mm a}". Also "Tomorrow with…", "Yesterday with…" and "{Weekday} with…".
- "Starts in {n} mins", "Starts in 1 min", "Starts in {h} h {m} mins", "Starts in {h} h", "Currently under way", "Fri, Nov 20".
- "At a glance", "Topics", "Actions due", "Agreements from last session", "Goals".
- "{n} overdue", "{n} active", "None yet", "None".
- "Open session".
- "No more sessions this week." and "Check back on Monday." The "Schedule a session" pill shows for schedulers only.
- Errors: "Couldn't load your next session", "Couldn't load your goals", "Try again".

## Test coverage map

Each manual case and the automated test that also covers it.

- **Unit** means pure functions, in Vitest.
- **Component** means React Testing Library with mocked hooks.
- **Integration** means real SWR hooks against MSW.
- **E2E** means Playwright with `page.route` mocks and a fixed clock, so it never needs a running backend.

Manual cases marked "manual only" need the real backend, real data, or human judgement.

| Manual case | Automated by | Phase |
|---|---|---|
| 2.1 header: title, date in profile zone, no Welcome or Add New | Component: `todays-briefing-panel.test.tsx` (fake clock across midnight, profile zone ≠ machine); E2E: no Add New, no "Welcome" | 5, 6 |
| 2.2 layout: side by side, stacks at `md`, card first | E2E: bounding boxes at 1280 and 760 wide | 6 |
| 2.3 entry points still reachable | E2E: the week panel's Schedule session opens the dialog (`new-session-dialog-layout.spec.ts`, updated) | 5 |
| 3.1 to 3.4 which session: today first, past skipped, tomorrow, weekday, next Monday excluded | Hook: `use-next-session.test.ts` (week bounds); Component: card picks; E2E: `page.clock` fixtures per case, and advancing the clock past a session's end moves the card on without a reload | 2, 5, 6 |
| 3.5 goals card follows; one week request, no today request | E2E: both cards name the same person; assert one `coaching_sessions` request with `include=relationship,series,topics,goal` and none with `organization` | 6 |
| 4.1 to 4.4 headline and when line, countdown | Unit: `next-session-copy.test.ts` (every wording, 1 min, whole hours, Yesterday, DST week); E2E: `page.clock.runFor` ticks "Starts in 30 mins" to "Starts in 29 mins" | 4, 6 |
| 4.5 no title, duration, Reschedule; "Open session" | Component | 5 |
| 5.1 At a glance open by default, header-only toggle, `aria-expanded` | Component; E2E: clicking a row's whitespace doesn't fold it | 5, 6 |
| 5.2, 5.3 row values, Agreements row hidden with no previous session | Unit: `summarizeActionsDue`; Component: rows from fixtures | 1, 5 |
| 5.4 Actions due equals the Due tab, same-day previous | Unit: `previousSessionOf` same-day (done); Integration: `useActionsDue` and `usePanelActions` on one MSW fixture return the same ids; E2E: `?panel=actions&actions=due` selects Due (`action-deep-link.spec.ts`) | 1, 6 |
| 5.5 row links | Component: every href; E2E: Agreements opens the previous session's URL | 5, 6 |
| 6.1, 6.2 overdue on the Actions page and cards | Unit: `isOverdue`, `addContextToAction` (done), `statusMeta` (frozen, done) | 1 |
| 7.1, 7.2 empty as a coach and as a coachee | Component; E2E: empty week fixture | 5, 6 |
| 7.3 loading: shaped placeholders, no spinner or pulse, no height jump | Component: no `animate-pulse`, same min-height; E2E: delayed route, card height equal before and after | 5, 6 |
| 7.4, 7.5 errors and Try again | Component: `card-error.test.tsx`, goals card error (phase 3); E2E: a route answers 500 then 200, and clicking Try again loads the card | 3, 6 |
| 8.1 Dark | E2E: `emulateMedia({ colorScheme: 'dark' })`; compute contrast of the error title, the icon and the overdue value against the card background, and require at least 4.5:1 | 6 |
| 8.2 phone: no horizontal scroll, 44px targets, stacking | E2E (Mobile Chrome project): `scrollWidth <= clientWidth`; every row, the header and the pill at least 44px tall | 6 |
| 8.3 keyboard order and toggling | E2E: Tab order header → rows → Open session; Space folds | 6 |
| 9.1 week panel regression | Existing `week-grid-*.spec.ts` stay green | all |
| 9.2 Join menu | Existing `join-session-menu.spec.ts` stays green | all |
| 9.3 warm cache on Open session | Manual only (timing on a real network) | |
| Real data correctness, visual match to screenshots 01 and 04, screen reader, real phone | Manual only | |

E2E runs in Docker on Chromium and Mobile Chrome only, per the repo's local-e2e rule: `npm run test:e2e:docker -- next-session-card --project=chromium --project="Mobile Chrome"`. CI covers the rest.

## Follow-ups (not in this PR)

- Light `destructive` (#ef4444) is 3.8:1 as text on white. That affects 22 `text-destructive` uses. `ForbiddenError`'s raw `bg-red-100 text-red-600` can move onto the error tokens in the same cleanup.
- `GoalsOverviewCard` moves into a `dashboard/briefing/` folder when the other three briefing cards land.
- `GoalsOverviewCardSkeleton` still uses `animate-pulse`; the style guide asks for static placeholders.
- The header's Join menu fetches today's sessions with its own include list. It could share a request later.
