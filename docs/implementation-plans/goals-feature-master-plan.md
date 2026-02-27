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

## Open Backend Questions (Block Layer 1)

Four architectural decisions must be resolved with the backend team before schema work begins.

**Q1: Goal Scoping — Relationship Column vs. Many-to-Many Join Table**

The frontend currently has `overarching_goals` with a `coaching_session_id` FK (1:1 per session). The new UX requires goals to span multiple sessions within a coaching relationship.

**Option A** — Add `coaching_relationship_id` to `overarching_goals`. Goals scope to the relationship; `coaching_session_id` becomes "originating session." Simpler schema, but no explicit tracking of which sessions discussed which goals.

**Option B** — Many-to-many join table `coaching_session_goals`. Explicit link/unlink of goals to sessions. Enables: per-session goal limit (MAX=3), goal drawer with link/unlink flow, goal detail timeline showing exactly which sessions discussed a goal.

The frontend needs: (a) list all goals for a coaching relationship, (b) list goals linked to a specific session, (c) link/unlink a goal from a session, (d) know which sessions discussed a goal.

Current schema: `overarching_goals` columns: `id`, `coaching_session_id` (FK), `user_id`, `title`, `body`, `status` (ItemStatus: NotStarted/InProgress/Completed/WontDo), `status_changed_at`, `completed_at`, `created_at`, `updated_at`. Endpoint `GET /users/{user_id}/overarching_goals` exists but only filters by `coaching_session_id`.

**Q2: Should `overarching_goal_id` Be Added to Actions?**

Prototypes show actions grouped by goal (actionsCompleted/actionsTotal per goal, goal detail actions tab). Currently, actions have `coaching_session_id` but no direct goal link.

**Option A** — Add `overarching_goal_id` FK to `actions`. Direct link, trivial queries, enables backend goal-level stats. Nullable for actions without a goal.

**Option B** — Derive association transitively through session-goal joins. Fragile (ambiguous when a session links to multiple goals), expensive to compute.

**Option C** — Separate `goal_actions` join table. Over-engineered unless actions can belong to multiple goals.

The frontend needs: efficiently query "all actions for goal X" and "completed vs total actions for goal X" without N+1 client-side fetching.

Current schema: `actions` columns: `id`, `coaching_session_id` (FK), `body`, `user_id`, `status` (ItemStatus), `status_changed_at`, `due_by`, `created_at`, `updated_at`. Also `action_assignees` join table.

**Q3: SSE Events for New Entities**

The frontend uses SSE cache invalidation (`src/lib/hooks/use-sse-cache-invalidation.ts`) for real-time updates. Currently handles `overarching_goal_created/updated/deleted`, `action_created/updated/deleted`, `agreement_created/updated/deleted`. New events will be needed for:

- Goal-session link/unlink (if join table approach from Q1): `coaching_session_goal_created`, `coaching_session_goal_deleted`
- Health signal changes (if computed asynchronously): `overarching_goal_health_updated`

These should be part of the backend implementation for any new entities/relationships.

**Q4: Note Annotation Persistence**

PR 5b adds the ability to mark selected text in coaching notes as linked to an Action, Agreement, or Goal. The coaching notes are persisted via TipTap Cloud (Yjs CRDT documents), not through our REST API. The annotation system needs:

- Custom TipTap marks (e.g. `actionMark`, `agreementMark`, `goalMark`) with `data-entity-id` attributes stored in the Yjs document
- When the editor loads, marks with entity IDs are rendered as colored annotations
- When the linked entity is deleted from the DB, the annotation must be removed from the note (converted back to plain text)

The backend question: should deletion of an Action/Agreement/Goal trigger an SSE event that the frontend uses to clean up stale marks in the TipTap document? Or should the frontend validate marks against the DB on load?

This is a cross-cutting concern between the REST API, SSE events, and TipTap Cloud storage. It needs a clear data flow design before implementation.

---

## API Gap Analysis

| Endpoint | Method | Purpose | Status |
|---|---|---|---|
| `GET /overarching_goals?coaching_session_id=` | GET | List goals for a session | Exists |
| `GET /users/{id}/overarching_goals` | GET | List all goals for a user | Exists (needs `status`, `coaching_relationship_id` filter params) |
| `GET /overarching_goals/{id}` | GET | Single goal | Exists |
| `POST /overarching_goals` | POST | Create goal | Exists (body needs `coaching_relationship_id`) |
| `PUT /overarching_goals/{id}` | PUT | Update goal | Exists |
| `PUT /overarching_goals/{id}/status` | PUT | Update goal status | Exists |
| `DELETE /overarching_goals/{id}` | DELETE | Delete goal | Missing from OpenAPI spec |
| `GET /users/{id}/overarching_goals?status=&coaching_relationship_id=` | GET | Filter by status and relationship | Needs new query params |
| `GET /actions?overarching_goal_id=` | GET | Actions for a goal | Needs new query param (pending Q2) |
| `POST /coaching_session_goals` | POST | Link goal to session | Entirely new (pending Q1) |
| `DELETE /coaching_session_goals` | DELETE | Unlink goal from session | Entirely new (pending Q1) |
| `GET /overarching_goals/{id}/summary` | GET | Aggregated stats (action counts, session count, health signal) | New — avoids N+1 |
| Health signal on goal responses | — | Backend-computed enum: `SolidMomentum / NeedsAttention / LetsRefocus` | New backend computation |

---

## PR Dependency Graph

```
Layer 1 (backend)
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

### Scope
- Resolve Q1 (goal scoping model), Q2 (`overarching_goal_id` on actions), Q3 (SSE events), Q4 (annotation persistence strategy)
- Add `coaching_relationship_id` to `overarching_goals` (and/or create join table, per Q1 answer)
- Add `status` and `coaching_relationship_id` query params to `GET /users/{id}/overarching_goals`
- Add `overarching_goal_id` query param to actions endpoints (per Q2 answer)
- Implement health signal computation logic on the backend, returned as a field on goal responses — this is a consistent metric available across all client types (web, future mobile)
- Add goal summary endpoint or enrich goal responses with action counts
- Add `DELETE /overarching_goals/{id}` if truly missing (or verify it exists and OpenAPI spec is incomplete)
- Add SSE events for any new entities/relationships

### Deliverable
Backend PR(s) with migrations, endpoint changes, and tests. Must be merged before frontend Layer 2 begins.

---

## Layer 2 — Frontend Types & API Layer

**Branch/PR:** `feat/goals-api-layer`

### Scope
- Update `OverarchingGoal` interface in `src/types/overarching-goal.ts` with new fields (`coaching_relationship_id`, `health`, action count fields, etc.)
- Add new types: `GoalHealth` enum (the backend-computed health signal: `SolidMomentum | NeedsAttention | LetsRefocus`), `GoalHealthMetrics` interface (aggregated stats per goal: actions completed/total, linked session count, health signal — the response shape from `GET /overarching_goals/{id}/summary` or enriched goal fields), `CoachingSessionGoal` join type (if Q1 resolves to join table)
- Update `OverarchingGoalApi` in `src/lib/api/overarching-goals.ts`: new query params on list, new hooks for user-level goal listing with filters
- Add new API functions for any new endpoints (goal-session link/unlink, goal summary)
- Update SSE cache invalidation in `src/lib/hooks/use-sse-cache-invalidation.ts` and `src/types/sse-events.ts` for any new event types from the backend
- Add/update sorting types in `src/types/sorting.ts`

### Key files
- `src/types/overarching-goal.ts`
- `src/types/general.ts` (if new enums needed)
- `src/lib/api/overarching-goals.ts`
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

Bottom sheet (85vh) opened from goal card click. Editable title/description, status dropdown, stats cards, tabs for session timeline and action groups.

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

**Requires Q4 resolution.** Extend the existing `SelectionBubbleMenu` with "Create Goal" and "Create Agreement" buttons. Implement custom TipTap marks for colored inline annotations that persist in Yjs and link to DB entities.

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
