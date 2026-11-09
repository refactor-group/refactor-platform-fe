# Week grid: living plan

The dashboard's Coaching Sessions card is replaced by a seven-day week panel. That card is the Upcoming and Previous tabs, the Today and This Week buckets, and the hover preview. The spec is the [Week Grid Handoff](https://claude.ai/artifact/DbvwCDt7C5zQF6EBkcYJUz), with artboard 10a as the visual source of truth.

The build runs with the overseer-handoff workflow. One overseer owns this plan, writes a handoff for each phase, and reviews each phase independently. A fresh implementer builds each phase. Jim approves every phase before the next handoff is written.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1a | Extract `useNow` and the session actions, with no behavior change | Done (`aea3a6b8`), approved |
| 1b | `week.ts`, `card.ts`, topics on the session read, `calculateSessionUrgency(now)`, plus frozen tests | Done (`57a8c48e`), approved |
| 1c | Grid UI, swap into the dashboard, context menu, Cancel/Remove copy, deletions | Done (`6fe0e8be`), approved |
| 2 | Paging and bounds, Schedule session, empty-day click, card click and double-click | Done (`feat/week-grid-nav`, through `8964e5da`), approved |
| 3 | Prepare pill, Ready footer, live note | Folded into PRs 1 and 2 (Jim, 2026-11-05); Part 3 of the test plan runs with PR 2 |
| 4 | Person filter, chip, dimmed cards | Done (`feat/week-grid-filter`, through `d9961f3e`), approved |
| BE 1 | Working hours on the user (rs) | refactor-platform-rs#472, verified by the frontend (`user_working_hours_fe_verified`) |
| BE 2 | One reschedule email once changes settle (rs) | Agreed with refactor-platform-rs-51 (topic `week-grid`); built after BE 1 |
| 5 | Drag to move, Undo, working hours in Settings and the dialog | In review (`feat/week-grid-drag`, through `bdffa11f`); live checks wait on BE 2 (Part 8) and a live Settings save |
| 6 | Mobile day strip, agenda, Move sheet | Done (`feat/week-grid-mobile`, through `085e2308`), approved |
| 7 | Coachee-only e2e and the manual test plan's roles part | Done (`feat/week-grid-roles`, `2af79d89`), approved; test plan 7.1 corrected to Open session only (Jim, 2026-11-06) |

PRs 1 and 2 merge together, and each later PR merges on its own (D13). Each PR opens as a draft. The results of each PR's manual test part go in its description. `docs/test-plans/week_grid_manual_testing.md` is written up front for the whole feature. It has one part per PR plus a final end-to-end pass (Part 9). It's frozen acceptance, so a PR may correct a case only with Jim's approval.

## Components

These live in `src/components/ui/dashboard/week-grid/`:

| Component | Role |
| --- | --- |
| `WeekPanel` | Fetches data, builds the models, picks desktop or mobile |
| `WeekPanelHeader` | Title, range, subline, filter, week arrows, Schedule session |
| `WeekGrid` | The seven columns, at `lg` (1024px) and wider |
| `DayColumn`, `SessionCard`, `EmptyDay` | One column |
| `DropSlots`, `DragGhost` | The drag layer (PR 5) |
| `DayStrip`, `DayAgenda`, `MoveSheet` | Below `lg` (PR 6) |

The pure model lives in `src/lib/week-grid/`: `week.ts`, `card.ts`, `filter.ts` and `slots.ts`. The state lives in `useWeekGridStore`.

## Decisions

| ID | Decision |
| --- | --- |
| D1 | Card actions go in a context menu: right-click, long-press, or the Menu key (shadcn `context-menu`). They reuse the existing dialogs. On mobile, Move… opens the Move sheet. |
| D2 | The Prepare pill opens the session page until a prepare-modal handoff exists. |
| D3 | Ready means the session has at least one topic (`include=topics`). It lives in one function, to be swapped for a server value later. |
| D4 | An empty-day click opens the dialog at Who, with the day preset (`openSchedule(day)`). It works on any empty day from today on, in any week (Jim, 2026-11-05). |
| D5 | Working hours are stored on the user and editable in Settings. They drive both the drop slots and the dialog's after-hours checks. |
| D6 | Rights are per session. Drag, click-to-reschedule and the full menu appear only where the viewer coaches. Schedule and the filter appear when the viewer coaches anyone. |
| D7 | Below `lg` (1024px), the grid becomes the day strip and agenda. |
| D8 | Prepare works on any week. |
| D9 | The handoff stays in Claude Docs and is linked from each PR. |
| D10 | "Moved" shows only on the card just moved, until you leave or reload the dashboard. |
| D11 | This file is the committed living plan, kept current in every PR. |
| D12 | PR 1 branches from main, in the `fe-week-grid` worktree. The reschedule summary work lands separately. |
| D13 | PRs 1 and 2 merge together. Until PR 6, PR 1 stacks the columns vertically below `lg`. |
| D14 | PR 1 runs as three phases: 1a, 1b and 1c. |
| D15 | The overseer runs implementers as subagents. Jim approves each phase. |
| D16 | User-facing copy says "Cancel session" and "Cancel series", never "Delete". |
| D17 | A coach can still remove a past session: "Remove session…" in the menu, using the same dialog with past-tense copy. |
| D21 | Each card shows its length beside the start, "2:30 PM · 50 min" (Jim, 2026-11-08). Durations are written with one shared `durationText`. |
| D20 | A live card keeps its topic status beside the countdown: "in 45 min · No topics yet" (the second part in amber) or "in 45 min · 3 topics" (Jim, 2026-11-06). |
| D19 | Today's column shows a "now" line with the current time (Jim, 2026-11-06). Columns aren't time-scaled, so it sits between cards: above the first session that hasn't started. It appears on the current week only, in the grid and in today's agenda, and follows the profile time zone and the 30-second clock. |
| D18 | A session that ended earlier today stays editable (Jim, 2026-11-06). It keeps the past look and "Done", but single-click reschedule, drag, Move and the full menu still work, and it cancels like any session still to change: "Cancel session…" with the Cancel dialog (Jim, 2026-11-08). Only locked sessions from earlier days say Remove. Sessions from earlier days stay locked. "Today" is judged in the profile time zone. |

## Reuse rules

Every new piece starts from existing code. When that code is private or about to be deleted, it is extracted into a shared module first, then both callers use it.

| New piece | Reuses |
| --- | --- |
| Week fetch | `useEnrichedCoachingSessionsForUser`, `useCurrentOrganization`, `useScheduleTimezone` |
| Arrow bounds | `useNearestEachCoachingSessions`, `useCoachingRelationshipList` |
| Week labels | `sessionStartIn`, `timeOfDay`, `shortDay`, `sessionCount`, `firstNameOf`, `formatWeekdayDate` |
| Card tense | `calculateSessionUrgency`, `livenessFromUrgency`, `isPastSession`, `PulsingDot` |
| Live clock | `useNow` (extracted from `useTodaysSessions`, phase 1a) |
| Card actions | `session-actions.ts` and `useSessionActions` (extracted from the session row and the sessions card, phase 1a), plus the existing dialogs |
| Person filter | `pickerPeople`, `PickerPerson`, and `person-search.tsx` (extracted from `person-picker.tsx`, PR 4); `FilterChip` |
| Drop slots | `BusySession`, `busySessions`, `overlapping`, `clashFor`, `Slot`, `WorkingHours` |
| Move write | `writeSessionMove` and the session cache refresh (extracted from `use-schedule-submit.ts`, PR 5); `toast` with `action` |
| Drag | The kanban's dnd-kit setup, using `MouseSensor` and `KeyboardSensor` |
| Breakpoint | `useMediaQuery`, with `WEEK_GRID_QUERY` added to `lib/breakpoints.ts` |

## Removal (phase 1c)

Delete:

- `coaching-sessions-card(-header).tsx`, `session-buckets/*`, `coaching-sessions-row.tsx` and `coaching-sessions-hover-detail.tsx`;
- `CoachingSessionBuckets`, `types/coaching-session-bucket.ts`, `useEnrichedCoachingSessionsForUserCounts`, `listCountsForUser` and `CoachingSessionCountByMonth`;
- the card filter store and its provider;
- their tests.

Keep the dialogs and `session-change-message.ts`.

Every PR runs `npx tsc --noEmit`, `npm run lint` and `npx -y knip`. The knip result is compared with the main baseline taken before 1a, and only new findings count.

## Backend PRs (refactor-platform-rs)

- **BE 1: working hours.**
  - Adds `users.working_hours_start` and `users.working_hours_end` as local `TIME`, defaulting to 08:00 and 17:30, on 30-minute steps.
  - Exposed on `GET /users/{id}` and `PUT /users/{id}`.
  - Board topic: `UserWorkingHours`.
  - Agreed details:
    - strict `HH:MM`, and the latest end is `23:30`;
    - a single field is checked against the stored other one;
    - the fields appear wherever the full user does;
    - a violation is a 422.
- **BE 2: settled reschedule emails.**
  - A single-session move no longer emails straight away. `coaching_sessions` gains:
    - `notified_date` and `notified_duration_minutes`;
    - `schedule_changed_at`;
    - `schedule_unsettled_since`.
  - A new sweep `Job` (every 15 seconds) sends one email once the schedule differs from what was announced, and either 60 seconds have passed since the last change or 5 minutes since the first.
  - An Undo means nothing is due. Claims follow `claim_due_reminders`.
  - The reminder sweep skips sessions whose new time hasn't been announced yet.
  - Board topic: `SessionRescheduleNoticeSettle`.
  - Agreed details:
    - it also covers dialog reschedules, so they email 60 to 75 seconds later;
    - a session starting within 5 minutes skips the wait;
    - an immediate send (this and following, a series edit, resend) absorbs a pending move;
    - a failed send retries up to 3 times;
    - the timings are set by `SESSION_RESCHEDULE_SETTLE_SECONDS` and `SESSION_RESCHEDULE_SETTLE_MAX_SECONDS`.

## Phase 1c rules

- The menu follows D1 and D17 exactly. An upcoming session the viewer coaches gets every item. A past one gets Open session and Remove session…. A session the viewer is coached in gets Open session only.
- Resend invite therefore never shows on a past card, so its disabled state and hint are deleted.
- Menu test ids become `session-action-<action>`, since the row is gone.
- The Prepare pill links to the session page now (D2), so PR 3 keeps only what's left of it.
- `DashboardContainer` loses its `locale` prop, which only the old card used.

## PR 2 rules

- `useWeekGridStore` holds the week offset (PR 2) and the person filter (PR 4).
- The previous arrow asks `/nearest` around this Monday, for every relationship the viewer is in. It disables once nothing is earlier.
- For a coach, the next arrow never disables, so any future week can be scheduled. For a coachee, it disables once nothing is later, read from `/nearest` around next Monday.
- While a read is loading or has failed, its arrow stays enabled.
- Schedule session and the empty-day Schedule follow `isACoach`, the same rule as Add New. Every empty day from today on shows "+ Schedule", in any week; past days never do.
- A single click waits 260ms for a possible double-click:
  - on an upcoming session the viewer coaches, it opens Reschedule;
  - otherwise it does nothing. A past session will open the Session glance once that's designed (Jim, 2026-11-05).
- A session that's under way opens on a single click, for anyone (review of #536, 2026-11-08).
- A double-click or Enter opens the session page.
- This week is disabled while on the current week, which gives it its faint look.

## PR 4 rules

- Test plan case 4.6 needs the filter to survive leaving the dashboard and to reset at logout. So the store's provider moves from the dashboard to the app-wide `providers.tsx`.
  - Only the filter is kept in `sessionStorage`, under the key `week-grid-store`.
  - The week offset lives in memory, so it survives in-app navigation but not a reload.
  - Logout calls `resetWeekGrid`.
- The filter lists the people the viewer coaches (`schedulablePeople`), in name order. Coachees and Inactive come from `activityByPerson` and `isInactive`, read from `/nearest` around now. Peers stay deferred.
- A saved filter for someone the viewer no longer coaches is dropped once relationships load.
- Filtered-out cards stay in place at 28% opacity. The subline and today's count include only visible cards. With a filter on and nothing visible, "No sessions match this week." shows.
- The filter applies to the week grid only, since the briefing it was meant to share with isn't built.
- The search field and the name match are extracted from `person-picker.tsx`, so the dialog and the filter share them.

## PR 6 rules

- **6a, then 6b.** The Move sheet needs the same slot model and move write as drag, so it ships in 6b, built on them. 6b uses the 8:00 to 17:30 fallback until BE 1 lands, and PR 5's drag then reuses both.
- **Breakpoint:** below 1024px (`WEEK_GRID_QUERY`), the panel shows the day strip and one day's agenda instead of the seven columns. The interim vertical stacking (D13) is removed.
- **Selected day:** the store holds `selectedDay`, and paging clears it. The default is today on the current week, otherwise Monday. Like the week offset, it isn't persisted.
- **Agenda cards:** these are the session cards with an Open session button added. Long-press opens the same context menu. An empty day reads "No sessions", with "+ Schedule" from today on.
- **"Back to this week":** a button below the header on narrow screens, once you've paged away.
- **6b, the slot model:** `slots.ts` (`daySlots`) builds the 30-minute starts from the start of working hours to the end, inclusive, so 8:00 to 17:30 gives 20 slots.
  - Each slot is free, taken (with the holder's first name), current or past.
  - The moving session's own slot is always included, even outside working hours.
  - Drag (PR 5) reuses it.
- **6b, working hours:** `useWorkingHours()` returns the backend's future default (8:00 to 17:30) until BE 1 lands, and then reads the user. The dialog keeps `DEFAULT_WORKING_HOURS` (9 to 5) until PR 5 swaps it, per D5.
- **6b, move write:** `writeSessionMove` is extracted from the dialog's submit, so the dialog, the sheet and drag all write a move the same way.
  - `useMoveSession` refreshes every `/coaching_sessions` read, marks the card "Moved" (D10), and shows "Moved Ehab to Thu, 10:00 AM · this session only" with Undo.
  - The moved marks clear when the week panel unmounts.
- **6b, entry points:** "Move" on agenda cards, and "Move…" in the narrow-layout menu, for upcoming sessions the viewer coaches. The sheet only allows free slots, so a clash can't happen there.

## PR 5 rules

- **5a, working hours end to end:**
  - `User` gains `working_hours_start` and `working_hours_end` (`"HH:MM"`).
  - `src/lib/working-hours.ts` parses and formats them; unreadable or backwards hours fall back to 8:00 to 17:30.
  - `useWorkingHours()` reads the signed-in user, with that same fallback while loading.
  - The New session dialog's after-hours checks and suggestions use it, which retires `DEFAULT_WORKING_HOURS` (D5).
  - Settings > Coaching preferences gets two half-hour selects that autosave together, like the default duration.
  - Tests that relied on 9 to 5 now pass an explicit `NINE_TO_FIVE` fixture or mock a 9-to-5 user.
- **5b, drag (wide layout only):**
  - **Sensors:** dnd-kit with `MouseSensor` (6px to start, left button only) and `KeyboardSensor`. Touch never drags, and right-click never drags.
  - **What drags:** upcoming cards the viewer coaches (`data-draggable`).
  - **While dragging:** the hovered non-past day unfolds into `daySlots` (`drop-slot-<date>-<HH:mm>`), and a tilted ghost follows the pointer.
  - **Drops:** `dropOutcome` decides.
    - A free slot moves the session via `useMoveSession`.
    - A taken slot opens the reschedule dialog on Resolve, at the dropped time, through `openMoveSession(session, This, Some(target))`.
    - Anything else is ignored.
  - **Trailing click:** a drag never also counts as a click.

## Offline (read only), Jim 2026-11-06

When the session read fails, the panel keeps working instead of collapsing to an error.
- **Already-loaded week:** SWR still holds the sessions, so they stay on screen with "Can't reach the server right now. These sessions may be out of date." and Try again.
- **Week never loaded:** it shows the seven empty days, with "Couldn't load this week's sessions." and Try again.
- **Read only either way:**
  - no drag, Move, single-click reschedule or empty-day Schedule;
  - Schedule session is disabled;
  - the menu offers Open session only.
- **Still works:** the filter, and paging to weeks already loaded.
- It returns to normal on the next successful read: SWR retries failed reads with backoff, and Try again or paging also refetch. Nothing is saved to disk, so it doesn't survive a reload.
- Built in `8321fde5` on `feat/week-grid-offline`.

## Follow-ups

- 1c: remove `useSessionActions.openSeries`, the row's copy of the action switch, and the two comments naming the row and the card, once the buckets are gone.
- The store (week offset, filter, recently moved) comes with the first phase that reads it (PR 2), so it never ships unused.
- Live uses the app's urgency levels: under way, imminent, or soon (within 2 hours). The handoff says "within the hour"; the shared thresholds win.

- **Keyboard drag is weak:** Space, the arrows, then Space works, and screen readers hear "Picked up …", each slot, and the result. But it takes several presses to reach the next day, and the picked-up card's own day unfolds. A drop that never moved counts as "Not moved". Keyboard users are better served by the menu's Reschedule…; improve this only if it's asked for.
- **Session glance (needs design):** a single click on a past card should open a dashboard dialog showing that session at a glance: its most important insights, actions assigned, suggested actions still waiting, agreements made, and topics discussed. Until it exists, the single click does nothing. The design system names a "Session glance" modal in the shared modal shell, and a bottom sheet on mobile, but there's no spec yet. It waits on a design handoff.
- The backend's `/coaching_sessions/counts` loses its only caller after 1c. Raise it on the board.
