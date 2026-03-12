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

**Q1: Goal Scoping — Option B (join table) confirmed — ✅ PR2 implemented**

- `overarching_goals` table renamed to `goals`
- `coaching_session_id` on goals renamed to `created_in_session_id` — **nullable**, allowing goals to be created outside a session context (e.g. from the dashboard or goals page)
- New `coaching_relationship_id` column added to `goals` for relationship scoping (**NOT NULL** with backfill migration deriving from `coaching_sessions.coaching_relationship_id`)
- New optional `target_date` field (DATE, nullable) — the intended achieve-by date for the goal; drives dynamic health heuristics when set
- New `coaching_sessions_goals` many-to-many join table with `goal_id` FK (not `overarching_goal_id`); join table hidden as implementation detail with nested endpoints (`POST/DELETE /coaching_sessions/{id}/goals`)
- **Active goal limit:** Max 3 InProgress goals per coaching relationship, **backend-enforced** at `entity_api` layer. Returns HTTP 409 Conflict with `ValidationError` containing active goal summaries. Frontend handles with destructive toast and `ActiveGoalLimitError` types
- Both FKs in the join table use **CASCADE** delete (matches `actions_users` pattern)
- Existing data is **backfilled** into the join table from current `coaching_session_id` relationships (separate data migration)
- **Auto-link on creation:** When `created_in_session_id` is provided, backend auto-inserts a join table row (interim behavior until PR3 carry-forward replaces it)

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
| `GET /goals?coaching_relationship_id=` | GET | List goals for a relationship | **PR2 done** — `coaching_relationship_id` required for auth (Option C) |
| `GET /users/{id}/goals?coaching_relationship_id=` | GET | List goals for a user, filtered by relationship | **PR2 done** — `coaching_relationship_id` query param |
| `GET /goals/{id}` | GET | Single goal | **PR2 done** — response includes `coaching_relationship_id`, `created_in_session_id`, `target_date` |
| `POST /goals` | POST | Create goal | **PR2 done** — body takes `coaching_relationship_id`; auto-links to originating session when `created_in_session_id` provided |
| `PUT /goals/{id}` | PUT | Update goal | **PR2 done** — active goal limit enforced on status transitions to InProgress |
| `PUT /goals/{id}/status` | PUT | Update goal status | **PR2 done** — active goal limit enforced on transitions to InProgress |
| `DELETE /goals/{id}` | DELETE | Delete goal | **PR2 done** — atomic delete with SSE event publishing |
| `POST /coaching_sessions/{id}/goals` | POST | Link goal to session | **PR2 done** — nested route (join table hidden as implementation detail) |
| `DELETE /coaching_sessions/{id}/goals/{goal_id}` | DELETE | Unlink goal from session | **PR2 done** — nested route |
| `GET /coaching_sessions/{id}/goals` | GET | Goals linked to a session (eager-loaded full models) | **PR2 done** — returns full goal models, not join table records |
| `GET /goals/{id}/sessions` | GET | Sessions that discussed a goal | **PR2 done** |
| `GET /users/{id}/goals?status=` | GET | Filter by status | Needs new query param |
| `GET /actions?goal_id=` | GET | Actions for a goal | Needs new query param (PR3) |
| `GET /goals/{id}/health` | GET | Aggregated stats (action counts, session count, health signal) | New — avoids N+1 (PR4) |
| `POST /actions/validate` | POST | Batch existence check for action IDs | New (PR5, annotation cleanup) |
| `POST /agreements/validate` | POST | Batch existence check for agreement IDs | New (PR5, annotation cleanup) |
| `POST /goals/validate` | POST | Batch existence check for goal IDs | New (PR5, annotation cleanup) |
| Health signal on goal responses | — | Backend-computed enum: `SolidMomentum / NeedsAttention / LetsRefocus` | New (PR4, computed sync on read) |

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

1. **PR1 — Rename:** `overarching_goals` → `goals` across DB table, API paths (`/overarching_goals` → `/goals`), and SSE event names (`overarching_goal_*` → `goal_*`) — **✅ MERGED**
2. **PR2 — Goal scoping:** — **✅ MERGED** (backend [PR #242](https://github.com/refactor-group/refactor-platform-rs/pull/242), frontend [PR #330](https://github.com/refactor-group/refactor-platform-fe/pull/330))
   - Add `coaching_relationship_id` (NOT NULL, backfill) to `goals`, rename `coaching_session_id` → `created_in_session_id` (nullable), add `target_date` (DATE, nullable)
   - Create `coaching_sessions_goals` join table (CASCADE on both FKs) with nested endpoints (hidden as implementation detail): `POST/DELETE /coaching_sessions/{id}/goals`, `GET /coaching_sessions/{id}/goals` (eager-loads full goal models), `GET /goals/{id}/sessions`
   - Separate schema and data migrations; data migration backfills join table from existing `created_in_session_id` links
   - Auto-link on creation: when `created_in_session_id` is provided, backend auto-inserts a `coaching_sessions_goals` row (extracted into `link_to_originating_session()` with CHANGEME markers for PR3 carry-forward)
   - Add `DELETE /goals/{id}` (atomic delete in transaction with SSE event publishing)
   - **Active goal limit:** Max 3 InProgress goals per coaching relationship, enforced at `entity_api` layer on create and status transitions. Returns HTTP 409 Conflict with `ValidationError` containing active goal summaries. Uses generic `EntityErrorKind::Conflict` (not a goal-specific error variant)
   - Protect middleware: `by_id` (path-based goal auth) and `by_coaching_session_id` (session-based auth) middleware on goal routes; authorizes via `coaching_relationship_id` directly
   - Entity helpers: `in_progress()` on goal model, `includes_user()` on coaching relationship model
   - Email helper: uses join table for session→goals lookup, formats as HTML ordered list, uses `max_in_progress_goals()` accessor instead of hardcoded limit
   - Coding standards: added "Error Variant Reuse" guidance — prefer generic, reusable error variants with context fields over one-off variants
3. **PR3 — Action FK + carry-forward:** Add nullable `goal_id` to `actions` (ON DELETE SET NULL), add `goal_id` query param to action list endpoints. Refactor `batch_load_goals` to use join table (CHANGEME in PR2). Implement carry-forward workflow (auto-link active goals on session creation)
4. **PR4 — SSE events + health:** Add `coaching_session_goal_created` and `coaching_session_goal_deleted` events for the join table; implement health signal computation (synchronous on read) via `GET /goals/{id}/health` returning `GoalHealthMetrics`
5. **PR5 — Validation endpoints:** `POST /actions/validate`, `POST /agreements/validate`, `POST /goals/validate` for annotation stale-mark cleanup

### PR2 Coordinated Deploy (completed)

PR2 was a breaking change requiring simultaneous frontend deployment. Both PRs were merged together. Key breaking changes:
- POST/PUT request bodies: `coaching_session_id` → `created_in_session_id` (nullable)
- `GET /goals` requires `coaching_relationship_id` as a query param — backend protect middleware authorizes through it directly
- Join table endpoints use nested routes: `POST /coaching_sessions/{id}/goals` (not flat `/coaching_sessions_goals`)
- `GET /coaching_sessions/{id}/goals` returns eager-loaded full goal models (not join table records)
- Goal responses include `coaching_relationship_id`, `created_in_session_id`, `target_date`

### Goal-Session Carry-Forward Workflow (PR3 scope)

When a coach creates a new coaching session, all **active goals** from the relationship are automatically linked to it via the `coaching_sessions_goals` join table (carry-forward model). The coach reviews them before/during the session.

**Opt-out model:** Goals are pre-linked (not manually attached). During a session, the coach/coachee can:
- Unlink an existing active goal from the current session
- Create a new goal and link it to the current session
- Link an existing unlinked goal to the current session

This means `coaching_sessions_goals` rows are **created at session-creation time** (not lazily). Frontend implication: the "create coaching session" flow will need a goal review/management step.

**PR2 interim behavior:** Goals are auto-linked to their originating session only (via `link_to_originating_session()`). Full carry-forward (auto-link all active goals on session creation) is PR3 scope. The `link_to_originating_session()` function has CHANGEME markers for removal when carry-forward replaces auto-linking.

### Deliverable
Backend PRs with migrations, endpoint changes, and tests. PR1 + PR2 are merged — frontend Layer 2 work can proceed. PR3–PR5 can land in parallel with early frontend work.

---

## Layer 2 — Frontend Types & API Layer

### PR2 companion (✅ MERGED — [PR #330](https://github.com/refactor-group/refactor-platform-fe/pull/330))

**What was delivered:**
- Updated `Goal` interface: removed `coaching_session_id`, added `coaching_relationship_id` (required), `created_in_session_id` (nullable), `target_date` (nullable)
- Hardened `isGoal` type guard with all field checks (title, body, target_date, status_changed_at, completed_at)
- `GoalApi.list()` sends `coaching_relationship_id` query param
- Added `GoalApi.listBySession()` → renamed to `listNested` using `EntityApi.listNestedFn` pattern for `GET /coaching_sessions/{id}/goals`
- Added `useGoalsBySession` hook with conditional URL construction (avoids embedding "null" string when session ID absent)
- Added `goalTitle()` helper and `DEFAULT_GOAL_TITLE` constant for consistent goal title display across 6 UI call sites
- Send `created_in_session_id` on goal creation to trigger backend auto-link
- SSE cache invalidation narrowed: `invalidateEndpoint('/coaching_sessions')` was too broad (caused title flash on goal updates) → replaced with targeted invalidator matching only `/coaching_sessions/{id}/goals` keys
- Active goal limit handling: `ActiveGoalLimitError` types, `extractActiveGoalLimitError` helper, destructive toast on HTTP 409 using `max_active_goals` from response (not hardcoded)
- Applied render guard pattern in `GoalContainer`
- 38 new tests: Goal type guard (27), GoalApi/hooks (11)

**Key files modified:**
- `src/types/goal.ts` — Goal interface, `isGoal` guard, `ActiveGoalLimitError` types, `goalTitle()` helper
- `src/lib/api/goals.ts` — `GoalApi`, `useGoalList`, `useGoalsBySession`, `listNested`
- `src/lib/hooks/use-sse-cache-invalidation.ts` — narrowed session-goal cache invalidation
- `src/components/ui/coaching-sessions/goal-container.tsx` — render guards, `handleGoalChange` accepts goal as parameter
- `src/components/ui/coaching-session.tsx`, `coaching-session-selector.tsx`, `dashboard/today-session-card.tsx`, `join-session-popover.tsx` — updated to use `goalTitle()` helper
- `__tests__/types/goal.test.ts`, `__tests__/lib/api/goals.test.ts` — new test files

### Remaining Layer 2 work (future PRs)

- Add `GoalHealth` enum (`SolidMomentum | NeedsAttention | LetsRefocus`), `GoalHealthMetrics` interface — blocked on backend PR4
- Add goal health API hook (`GET /goals/{id}/health`) — blocked on backend PR4
- Add `CoachingSessionGoal` join table events to SSE types (`coaching_session_goal_created/deleted`) — blocked on backend PR4
- Add entity validation API functions (`POST /actions/validate`, etc.) — blocked on backend PR5
- Add `goal_id` param support in action API hooks — blocked on backend PR3
- Add user-level goal listing with `status` filter param — blocked on backend adding `status` query param

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
