# Goals Feature — Master Implementation Plan

## Context

The current overarching goal model is a per-session text label (`OverarchingGoal` has a `coaching_session_id` FK, 1:1 with sessions). The coaching platform needs goals to be **relationship-level entities tracked across multiple sessions** — a coach and coachee work on a small set of active goals across many sessions, each goal accumulating actions, agreements, and session history over time.

The prototypes under `src/app/prototype/` (dashboard-goals, goals-hub, session-goals, goal-detail, review-actions) demonstrate the target UX. This plan turns those prototypes into production code, broken into independently mergeable branches/PRs ordered bottom-up by dependency.

### Visual Design Direction

The prototypes establish a refined UI theme inspired by Mercury's dashboard aesthetic: clean card-based layouts with `shadow-none` borders, muted low-contrast palette (`text-muted-foreground/60`), small precise typography (`text-[11px]`, `text-[13px]`, `tabular-nums`), generous whitespace, and status indicators using subtle colored dots rather than heavy badges. **Every implementation PR must match the prototype's styling as closely as possible.** This is the new design direction for the platform — not just for goals, but as the visual standard going forward.

### Prototype Validation Rule

For all PRs in Layer 3 and beyond, the corresponding prototype page serves as the **visual and functional specification**. Before marking any PR complete, compare the implementation against the prototype for:
- Layout, spacing, and typography fidelity
- Interaction behavior (hover states, expand/collapse, transitions)
- Data display patterns (progress bars, status indicators, counts)
- Responsive breakpoints (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`)

---

## Resolved Backend Decisions

All four architectural questions have been resolved with the backend team. These decisions are now confirmed and inform all subsequent layers.

**Q1: Goal Scoping — Option B (join table) confirmed**

- `overarching_goals` table renamed to `goals`
- `coaching_session_id` on goals renamed to `created_in_session_id` — **nullable**, allowing goals to be created outside a session context (e.g. from the dashboard or goals page)
- New `coaching_relationship_id` column added to `goals` for relationship scoping
- New optional `target_date` field (DATE, nullable) — the intended achieve-by date for the goal; drives dynamic health heuristics when set
- New `coaching_sessions_goals` many-to-many join table with `goal_id` FK (not `overarching_goal_id`)
- Enables: per-session goal limit (MAX=3), goal drawer link/unlink flow, goal detail timeline

**Q2: Action FK — Option A (direct FK) confirmed**

- Nullable `goal_id` column added to `actions` table (ON DELETE SET NULL)
- When a goal is deleted, associated actions are preserved with `goal_id` set to NULL
- Enables: `GET /actions?goal_id=X`, backend goal-level stats computation

**Q3: SSE Events — Confirmed**

- Goal events renamed: `goal_created`, `goal_updated`, `goal_deleted` (replacing `overarching_goal_*`)
- Two new events for join table: `coaching_session_goal_created`, `coaching_session_goal_deleted`
- Health signals computed **synchronously on read** — no separate health event needed; existing action events trigger cache invalidation which causes goal data to re-fetch with updated health
- Health heuristics are **dynamic when `target_date` is set**: compares elapsed time % vs action progress %. When `target_date` is null, health reflects **momentum only** (action completion regularity, no time pressure)

**Q4: Annotation Persistence — Option C (both SSE + load-time) confirmed**

- SSE cleanup for real-time mark removal when entities are deleted while notes are open
- Load-time validation as safety net for entities deleted while user was offline
- **Per-entity-type validation endpoints** (not a single cross-entity endpoint):
  - `POST /actions/validate` — body: `{ ids: [UUID, ...] }`, response: `{ valid: [...], invalid: [...] }`
  - `POST /agreements/validate` — same shape
  - `POST /goals/validate` — same shape

---

## API Gap Analysis

| Endpoint | Method | Purpose | Status |
|---|---|---|---|
| `GET /goals?coaching_session_id=` | GET | List goals for a session | Exists (path renamed from `/overarching_goals`) |
| `GET /users/{id}/goals` | GET | List all goals for a user | Exists (needs `status`, `coaching_relationship_id` filter params) |
| `GET /goals/{id}` | GET | Single goal | Exists |
| `POST /goals` | POST | Create goal | Exists (body needs `coaching_relationship_id`) |
| `PUT /goals/{id}` | PUT | Update goal | Exists |
| `PUT /goals/{id}/status` | PUT | Update goal status | Exists |
| `DELETE /goals/{id}` | DELETE | Delete goal | Backend to verify/add |
| `GET /users/{id}/goals?status=&coaching_relationship_id=` | GET | Filter by status and relationship | Needs new query params |
| `GET /actions?goal_id=` | GET | Actions for a goal | Needs new query param |
| `POST /coaching_sessions_goals` | POST | Link goal to session | New |
| `DELETE /coaching_sessions_goals/{id}` | DELETE | Unlink goal from session | New |
| `GET /coaching_sessions/{id}/goals` | GET | Goals linked to a session | New |
| `GET /goals/{id}/sessions` | GET | Sessions that discussed a goal | New |
| `GET /goals/{id}/health` | GET | Aggregated stats (action counts, session count, health signal) | New — avoids N+1 |
| `POST /actions/validate` | POST | Batch existence check for action IDs | New (annotation cleanup) |
| `POST /agreements/validate` | POST | Batch existence check for agreement IDs | New (annotation cleanup) |
| `POST /goals/validate` | POST | Batch existence check for goal IDs | New (annotation cleanup) |
| Health signal on goal responses | — | Backend-computed enum: `SolidMomentum / NeedsAttention / LetsRefocus` | New (computed sync on read) |

---

## PR Dependency Graph

```
Layer 1 (backend — 5 PRs)
  └─► Layer 2 (frontend types & API)
        ├─► PR 3a (Dashboard: Goals Overview Card)
        │     └─► PR 3b (Dashboard: Upcoming Session Card)
        │           └─► PR 3c (Dashboard: Sessions dual-view — list)
        │                 └─► PR 3d (Dashboard: Sessions dual-view — timeline)
        ├─► PR 4a (Goals Page: main view)
        │     └─► PR 4b (Goals Page: Goal Detail Sheet)
        └─► PR 5a (Session: Goal drawer replacement)
              └─► PR 5b (Session: Notes selection menu + annotations)
```

---

## Layer 1 — Backend Schema & API Changes

**Repo:** refactor-platform-rs (backend)
**Blocks:** Everything else

### Confirmed scope (5-PR backend plan)

The backend team has committed to a 5-PR implementation plan:

1. **PR1 — Rename:** `overarching_goals` → `goals` across DB table, API paths (`/overarching_goals` → `/goals`), and SSE event names (`overarching_goal_*` → `goal_*`)
2. **PR2 — Goal scoping:** Add `coaching_relationship_id` to `goals`, rename `coaching_session_id` → `created_in_session_id` (nullable), add `target_date` (DATE, nullable), create `coaching_sessions_goals` join table with CRUD endpoints
3. **PR3 — Action FK:** Add nullable `goal_id` to `actions` (ON DELETE SET NULL), add `goal_id` query param to action list endpoints
4. **PR4 — SSE events:** Add `coaching_session_goal_created` and `coaching_session_goal_deleted` events for the join table
5. **PR5 — Validation endpoints:** `POST /actions/validate`, `POST /agreements/validate`, `POST /goals/validate` for annotation stale-mark cleanup

Additional backend work (may be part of the above PRs or separate):
- Add `status` and `coaching_relationship_id` query params to `GET /users/{id}/goals`
- Implement health signal computation (synchronous, on read) via `GET /goals/{id}/health`
- Health endpoint returns `GoalHealthMetrics` (action counts, session count, health signal)
- Verify/add `DELETE /goals/{id}`

### Deliverable
Backend PRs with migrations, endpoint changes, and tests. Frontend Layer 2 can begin after PR1 + PR2 are merged (the rename and scoping changes). PR3–PR5 can land in parallel with early frontend work.

---

## Layer 2 — Frontend Types & API Layer

**Branch/PR:** `feat/goals-api-layer`

### Scope
- Rename `OverarchingGoal` → `Goal` interface in `src/types/goal.ts` (renamed from `overarching-goal.ts`), with updated fields: `created_in_session_id` (nullable, was `coaching_session_id`), new `coaching_relationship_id`, new `target_date` (nullable DATE), `health`, action count fields
- Add new types: `GoalHealth` enum (`SolidMomentum | NeedsAttention | LetsRefocus`), `GoalHealthMetrics` interface (aggregated stats: actions completed/total, linked session count, health signal), `CoachingSessionGoal` join type
- Rename `OverarchingGoalApi` → `GoalApi` in `src/lib/api/goals.ts` (renamed from `overarching-goals.ts`): update base URL to `/goals`, new query params, new hooks for user-level goal listing with filters
- Add new API functions: goal-session link/unlink (`POST/DELETE /coaching_sessions_goals`), goal health (`GET /goals/{id}/health`), entity validation (`POST /actions/validate`, etc.)
- Update SSE cache invalidation in `src/lib/hooks/use-sse-cache-invalidation.ts` and `src/types/sse-events.ts`: rename `overarching_goal_*` → `goal_*`, add `coaching_session_goal_created/deleted`
- Update all imports and call sites across the codebase that reference the old names
- Add/update sorting types in `src/types/sorting.ts`

### Key files
- `src/types/goal.ts` (renamed from `overarching-goal.ts`)
- `src/types/general.ts` (if new enums needed)
- `src/lib/api/goals.ts` (renamed from `overarching-goals.ts`)
- `src/types/sse-events.ts`
- `src/lib/hooks/use-sse-cache-invalidation.ts`
- `src/types/sorting.ts`

---

## Layer 3 — Dashboard Component Updates

### PR 3a: Goals Overview Card
**Branch:** `feat/dashboard-goals-overview`

New component: a collapsible card on the dashboard showing the user's active goals with a circular SVG progress ring, per-goal action progress rows, and health signal.

**Prototype reference:** `src/app/prototype/dashboard-goals/page.tsx` — `GoalsOverviewCard` and `ProgressRing` functions.

**Key files:** `src/components/ui/dashboard/goals-overview-card.tsx`, `progress-ring.tsx`, `goal-row.tsx`. Modify `dashboard-container.tsx`.

### PR 3b: Upcoming Session Card
**Branch:** `feat/dashboard-upcoming-session-card`

Replace `TodaySessionCard` + `TodaysSessions` carousel with a single **Upcoming Session Card**. Shows next session with participant, goal chip, action count, live countdown, Reschedule/Join.

**Prototype reference:** `src/app/prototype/dashboard-goals/page.tsx` — `TodaySessionCard` function (line 193: "Upcoming session").

**Key files:** New `upcoming-session-card.tsx`. Modify `dashboard-container.tsx`. Deprecate `todays-sessions.tsx` carousel.

### PR 3c: Sessions Dual-View — List
**Branch:** `feat/dashboard-sessions-list`

Replace `CoachingSessionList` with new sessions card containing list view with master-detail hover pattern.

**Prototype reference:** `src/app/prototype/dashboard-goals/page.tsx` — `SessionRow` function.

**Key files:** New `sessions-card.tsx`, `sessions-list-view.tsx`, `session-row.tsx`. Modify `dashboard-container.tsx`.

### PR 3d: Sessions Dual-View — Timeline
**Branch:** `feat/dashboard-sessions-timeline`

Add timeline view: horizontal day timeline (6 AM–9 PM), draggable session blocks, 5-minute snap, "Now" indicator, reschedule confirmation.

**Prototype reference:** `src/app/prototype/dashboard-goals/page.tsx` — `DayTimeline` function.

**Key files:** New `sessions-timeline-view.tsx`, `day-timeline.tsx`. Modify `sessions-card.tsx`.

---

## Layer 4 — Goals Page

### PR 4a: Goals Page Main View
**Branch:** `feat/goals-page`
**Route:** `src/app/goals/`

New top-level page following `src/app/actions/` naming pattern. Status filter toggle, summary banner, responsive goal card grid, inline goal creation.

**Prototype reference:** `src/app/prototype/goals-hub/page.tsx` — `GoalsHubPrototype`, `SummaryBanner`, `GoalCard`, `NewGoalCard`.

**Key files:** `src/app/goals/layout.tsx`, `page.tsx`, `src/components/ui/goals/goals-page-container.tsx`, `goals-page-header.tsx`, `goal-card.tsx`, `new-goal-card.tsx`, `summary-banner.tsx`. Modify `app-sidebar.tsx`.

### PR 4b: Goal Detail Sheet
**Branch:** `feat/goals-detail-sheet`

Bottom sheet (85vh) opened from goal card click. Editable title/description, status dropdown, optional `target_date` date picker, stats cards, tabs for session timeline and action groups.

**Prototype reference:** `src/app/prototype/goals-hub/page.tsx` — `GoalDetailSheet`, `TimelineSession`, `ActionGroup`, `ActionRow`. Also `goal-detail/page.tsx` for inline-edit.

**Key files:** `src/components/ui/goals/goal-detail-sheet.tsx`, `goal-session-timeline.tsx`, `goal-action-groups.tsx`, `goal-stat-card.tsx`.

---

## Layer 5 — Coaching Session Page Changes

### PR 5a: Goal Drawer Replacement
**Branch:** `feat/session-goal-drawer`

Replace `OverarchingGoalContainer` (single-goal strip) with multi-goal drawer: collapsible bar with goal chips, progress cards, goal picker combobox for link/unlink.

**Prototype reference:** `src/app/prototype/session-goals/page.tsx` — `GoalDrawer`, `GoalChip`, `GoalPicker`.

**Key files:** New `goal-drawer.tsx`, `goal-chip.tsx`, `goal-picker.tsx`. Modify `coaching-sessions/[id]/page.tsx`. Replace `overarching-goal-container.tsx` and `overarching-goal.tsx`.

### PR 5b: Notes Selection Menu + Annotations
**Branch:** `feat/session-notes-annotations`

Extend the existing `SelectionBubbleMenu` with "Create Goal" and "Create Agreement" buttons. Implement custom TipTap marks for colored inline annotations that persist in Yjs and link to DB entities.

**Annotation cleanup strategy (Q4 resolved):**
- **Real-time:** SSE events (`goal_deleted`, `action_deleted`, `agreement_deleted`) trigger mark removal in open editors
- **Load-time safety net:** On editor load, collect all `entityId` values from marks, batch-validate via `POST /goals/validate`, `POST /actions/validate`, `POST /agreements/validate`, remove stale marks

**Prototype reference:** `src/app/prototype/session-goals/page.tsx` — `MockBubbleMenu`, `MarkPopover`.

**Key files:** Modify `selection-bubble-menu.tsx`, `coaching-tabs-container.tsx`, `coaching-notes.tsx`. New `entity-mark-extension.tsx`, `mark-popover-extension.tsx`.

---

## Testing Strategy

### Unit tests (Vitest + jsdom + MSW)
Default for all PRs. TDD approach: write failing tests first, implement, verify pass.

### Playwright E2E tests
Reserve for complex interactions:

| PR | E2E Candidate | Why |
|---|---|---|
| PR 3d | Drag-to-reschedule | Pointer capture + coordinate math needs real browser |
| PR 4a | Status filter + URL sync | URL ↔ filter ↔ grid state round-trip |
| PR 5a | Goal picker + link/unlink | Complex popover + combobox chain |
| PR 5b | Mark creation + persistence | TipTap + selection + marks requires real DOM |

---

## Rules Applied to Every PR

1. Read `.claude/coding-standards.md` before writing code; conform to all patterns
2. Inventory existing components, hooks, types, utils for reuse; verify existing call sites on extension
3. Identify existing tests for modified code; enumerate and preserve regression coverage
4. TDD: write focused, failing tests first → implement → verify pass → refactor
5. Prefer discriminated unions and Result types over nullable types
6. Thread `locale` and config values via props, not `siteConfig` imports in leaf components
7. Use render guards (not `|| ""` fallbacks) for nullable hook values
8. Import React hooks directly, not via `React.` prefix
9. **Validate against prototype:** compare styling and functional behavior to the corresponding prototype page before marking complete
