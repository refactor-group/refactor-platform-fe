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
| 1 | `lib/actions-due.ts` + `useActionsDue`; move the panel, `statusMeta` and `addContextToAction` onto it | pending |
| 2 | Week plumbing: `useWeekAt` export, `+Goal` include, `useNextSession`; goals card on it; `?actions=due` | pending |
| 3 | Error tokens; `ui/errors/card-error.tsx`; goals card error on `CardError` | pending |
| 4 | `lib/next-session-copy.ts` (headline, when line) | pending |
| 5 | `TodaysBriefingPanel`, `NextSessionCard` and its parts; swap them into the container; delete the old files | pending |
| 6 | `.claude/file-organization.md`, the CLAUDE.md row, the coding-standards pointer | pending |
| — | Overseer: real-backend check, light/dark/phone screenshots, draft PR | pending |

Baseline on main `b60f695` (Node 24): tsc clean, lint 0 errors / 85 warnings, unit tests 337 files / 3374 tests.

## Decisions

| Topic | Decision |
|---|---|
| Which session | The next non-past session through Sunday of the current week (Monday to Sunday in the user's zone). `selectNextUpcomingSession` over `useWeekSessions(useWeekAt(0))` |
| Shared selection | `useNextSession()` is read by both cards. The goals card drops `useTodaysSessions`, and its organization id comes from `useCurrentOrganization` |
| Week request | `WEEK_INCLUDES` gains `Goal`. One request is shared by the week panel, the new card and the goals card |
| Actions due | One module, `lib/actions-due.ts`: `previousSessionOf`, `actionsDueAt` (the Due tab's set), `isOverdue`, `summarizeActionsDue`, and the session-list window constants. `useActionsDue` fetches with the same keys as the session page's Actions panel |
| Overdue | Open status (not started, in progress) and a due day before today in the user's zone. On hold, completed and won't do are never overdue. Applies to the card, `statusMeta` and the Actions page |
| Actions due count | Equals the Due tab, completed actions included. "{n} overdue" in warning when any are overdue, otherwise the count, "None" at zero |
| Goals row | `session.goals` count, which the backend caps at 3 in-progress goals. Accepted |
| Topics row | `session.topics` from the week request |
| Row links | Topics `?panel=topics`, Actions due `?panel=actions&actions=due`, Goals `?panel=goals`. Agreements from last session goes to the previous session with `?panel=agreements`, and the row is hidden when there is no previous session |
| Under way across midnight | The headline names the start day ("Yesterday") |
| Card styling | Populated, empty and loading are the hero card (`bg-hero-wash border-brand-border shadow-card`). Error is a plain `bg-card border` card |
| Loading | Static `bg-fill` blocks shaped like the result, no `animate-pulse` (style guide) |
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

## Follow-ups (not in this PR)

- Light `destructive` (#ef4444) is 3.8:1 as text on white. That affects 22 `text-destructive` uses. `ForbiddenError`'s raw `bg-red-100 text-red-600` can move onto the error tokens in the same cleanup.
- `GoalsOverviewCard` moves into a `dashboard/briefing/` folder when the other three briefing cards land.
- The header's Join menu fetches today's sessions with its own include list. It could share a request later.
