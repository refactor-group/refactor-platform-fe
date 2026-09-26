# Goals Feature — Backend Planning Questions

**Purpose:** This document captures the four architectural questions that were brought to the backend team, along with the options considered and the final decisions.

**Status:** All questions resolved. Decisions are incorporated into the [master plan](./goals-feature-master-plan.md).

**Frontend master plan:** `docs/implementation-plans/goals-feature-master-plan.md`

---

## Current State

### What exists today

**Database schema (`overarching_goals` table — being renamed to `goals`):**
```
id                  UUID (PK)
coaching_session_id UUID (FK → coaching_sessions)  ← renaming to created_in_session_id
user_id             UUID (FK → users)
title               TEXT (nullable)
body                TEXT (nullable)
status              ItemStatus enum (NotStarted | InProgress | Completed | WontDo)
status_changed_at   TIMESTAMPTZ
completed_at        TIMESTAMPTZ
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

**Existing API endpoints for overarching goals (paths being renamed `/overarching_goals` → `/goals`):**

| Method | Path | Query Params | Notes |
|--------|------|-------------|-------|
| GET | `/overarching_goals` | `coaching_session_id`, `sort_by`, `sort_order` | List goals for a session |
| POST | `/overarching_goals` | — | Body: `{ coaching_session_id, title?, body?, status }` |
| GET | `/overarching_goals/{id}` | — | Single goal |
| PUT | `/overarching_goals/{id}` | — | Full update |
| PUT | `/overarching_goals/{id}/status` | `value` | Status-only update |
| GET | `/users/{user_id}/overarching_goals` | `coaching_session_id`, `sort_by`, `sort_order` | User-scoped goal list |
| DELETE | `/overarching_goals/{id}` | — | **Confirmed** — included in backend PR2 |

**Existing related tables:**

```
actions table:
  id, coaching_session_id (FK), body, user_id, status, status_changed_at,
  due_by, created_at, updated_at

action_assignees table (many-to-many):
  action_id (FK → actions), user_id (FK → users)

agreements table:
  id, coaching_session_id (FK), body, user_id, created_at, updated_at

coaching_sessions table:
  id, coaching_relationship_id (FK), date, created_at, updated_at

coaching_relationships table:
  id, coach_id (FK → users), coachee_id (FK → users), organization_id (FK),
  created_at, updated_at
```

**Existing SSE events:** `overarching_goal_created`, `overarching_goal_updated`, `overarching_goal_deleted`, `action_created`, `action_updated`, `action_deleted`, `agreement_created`, `agreement_updated`, `agreement_deleted`

### What the new UX requires

The frontend prototypes model goals as **relationship-level entities tracked across multiple sessions**. A coach and coachee work on 1–3 active goals across 20+ sessions. Each goal:
- Has a lifecycle: Active → On Hold → Completed or Abandoned
- Accumulates actions from multiple sessions
- Tracks which sessions discussed it (displayed as a vertical timeline)
- Shows progress: `actionsCompleted / actionsTotal`
- Has a health signal: `SolidMomentum | NeedsAttention | LetsRefocus`
- Can be linked/unlinked from individual sessions (max 3 goals per session)

---

## Q1: Goal Scoping — Relationship Column vs. Many-to-Many Join Table

> **Decision: Option B (join table) — confirmed**

### The problem

`overarching_goals.coaching_session_id` makes goals 1:1 with sessions. The new UX needs goals to span multiple sessions within a coaching relationship.

### Option A: Add `coaching_relationship_id` column

```sql
ALTER TABLE overarching_goals
  ADD COLUMN coaching_relationship_id UUID REFERENCES coaching_relationships(id);
-- coaching_session_id becomes "originating session" (where goal was first created)
```

**Pros:**
- Simple schema change
- One column addition, no new tables
- Goals are naturally scoped to a relationship

**Cons:**
- No explicit record of which sessions discussed which goals
- Cannot enforce per-session goal limit (MAX=3) — note: even with Option B, this is frontend-only enforcement
- Goal detail timeline ("which sessions discussed this goal") requires inferring from actions/notes — no direct join
- Cannot "link/unlink" a goal from a session — it's either scoped to the relationship or not

**Frontend impact:**
- (a) list all goals for a relationship: `GET /goals?coaching_relationship_id=X` — works
- (b) list goals linked to a specific session: **Cannot do directly** — would need to infer from actions or other data
- (c) link/unlink a goal from a session: **Not possible** — goals exist at the relationship level
- (d) know which sessions discussed a goal: **Indirect only** — infer from actions created in those sessions

### Option B: Many-to-many join table (CHOSEN)

```sql
-- Rename table and column
ALTER TABLE overarching_goals RENAME TO goals;
ALTER TABLE goals RENAME COLUMN coaching_session_id TO created_in_session_id;
-- created_in_session_id is NULLABLE — goals can be created outside a session context

-- Add relationship scoping and target date
ALTER TABLE goals
  ADD COLUMN coaching_relationship_id UUID NOT NULL REFERENCES coaching_relationships(id),
  -- backfill: derive from coaching_sessions.coaching_relationship_id via created_in_session_id
  ADD COLUMN target_date DATE;  -- optional achieve-by date, drives dynamic health heuristics

-- New join table for explicit session-goal links
CREATE TABLE coaching_sessions_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coaching_session_id UUID NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
  goal_id         UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coaching_session_id, goal_id)
);
-- Backfill: populate join table rows from existing coaching_session_id (now created_in_session_id) data
```

**New endpoints (PR2 implemented — nested routes, join table hidden as implementation detail):**
```
POST   /coaching_sessions/{id}/goals          — Link a goal to a session (body: {goal_id})
DELETE /coaching_sessions/{id}/goals/{goal_id} — Unlink a goal from a session
GET    /coaching_sessions/{id}/goals           — List goals linked to a session (eager-loads full goal models)
GET    /goals/{id}/sessions                    — List sessions that discussed a goal
```

**Pros:**
- Explicit tracking of which sessions discussed which goals
- Supports per-relationship active goal limit (MAX=3 InProgress, **backend-enforced** — returns HTTP 409 Conflict with active goal summaries)
- Enables the goal drawer UX: link/unlink goals per session
- Goal detail timeline is a direct query on the join table
- `created_in_session_id` on `goals` remains as "originating session"

**Cons:**
- More complex schema (new table, new endpoints, new CRUD)
- More SSE events to emit (`coaching_session_goal_created`, `coaching_session_goal_deleted`)
- Migration needs to populate `coaching_relationship_id` for existing goals (derive from `coaching_sessions.coaching_relationship_id`)

**Frontend impact:**
- (a) list all goals for a relationship: `GET /goals?coaching_relationship_id=X` — works (**required** for auth — Option C confirmed)
- (b) list goals linked to a specific session: `GET /coaching_sessions/{id}/goals` — direct query (used instead of filtering `GET /goals` by `created_in_session_id`)
- (c) link/unlink a goal from a session: `POST/DELETE /coaching_sessions/{id}/goals` — nested routes (join table hidden as implementation detail)
- (d) know which sessions discussed a goal: `GET /goals/{id}/sessions` — direct query
- (e) `created_in_session_id` is **display metadata only** (which session originated the goal) — not used as a query filter on `GET /goals`
- (f) auto-link on creation: when `created_in_session_id` is provided in `POST /goals`, backend auto-inserts a join table row

### Additional decisions made alongside Q1

- **Table rename:** `overarching_goals` → `goals` (simpler, matches UX terminology)
- **Column rename:** `coaching_session_id` → `created_in_session_id` on goals (nullable — goals can be created outside a session)
- **`coaching_relationship_id`:** NOT NULL with backfill migration (derived from `coaching_sessions.coaching_relationship_id`)
- **New field:** `target_date` (DATE, nullable) — optional achieve-by date; drives dynamic health heuristics
- **Join table name:** `coaching_sessions_goals` (plural "sessions")
- **Join table FK:** `goal_id` (not `overarching_goal_id`)
- **Join table CASCADE:** Both FKs use ON DELETE CASCADE (matches `actions_users` pattern)
- **Join table backfill:** Existing data populated from current `coaching_session_id` relationships
- **`DELETE /goals/{id}`:** Implemented in PR2 — atomic delete in transaction with SSE event publishing
- **Active goal limit (MAX=3 InProgress per relationship):** **Backend-enforced** at `entity_api` layer on create and status transitions to InProgress. Returns HTTP 409 Conflict with `ValidationError` containing `message` + structured `details` payload (active goal summaries). Uses generic `EntityErrorKind::Conflict` mapped through existing error chain (not a goal-specific error variant). Frontend handles with `ActiveGoalLimitError` types and destructive toast; uses `max_active_goals` from 409 response (not hardcoded)
- **Authorization (Option C):** `GET /goals` requires `coaching_relationship_id` — backend protect middleware (`by_id`, `by_coaching_session_id`) authorizes through `coaching_relationship_id` directly. Frontend never queries goals by `created_in_session_id` alone; for session-linked goals, use `GET /coaching_sessions/{id}/goals`
- **Auto-link on creation:** When `created_in_session_id` is provided, backend auto-inserts a `coaching_sessions_goals` row (extracted into `link_to_originating_session()` with CHANGEME markers for PR3 carry-forward)

### PR2 coordinated deploy (✅ completed)

PR2 was a breaking change requiring simultaneous frontend deployment. Both PRs merged together:
- Backend: [PR #242](https://github.com/refactor-group/refactor-platform-rs/pull/242)
- Frontend: [PR #330](https://github.com/refactor-group/refactor-platform-fe/pull/330)

Breaking changes deployed:
- POST/PUT request bodies: `coaching_session_id` → `created_in_session_id` (nullable)
- `GET /goals` requires `coaching_relationship_id` query param for auth
- Join table endpoints use nested routes: `POST/DELETE /coaching_sessions/{id}/goals` (not flat `/coaching_sessions_goals`)
- `GET /coaching_sessions/{id}/goals` returns eager-loaded full goal models (not join table records)
- Goal responses include `coaching_relationship_id`, `created_in_session_id`, `target_date`
- HTTP 409 on exceeding 3 InProgress goals per relationship

### Goal-session carry-forward workflow (PR3 scope)

When a coach creates a new coaching session, all **active goals** from the relationship are automatically linked via the join table (carry-forward model). Goals are pre-linked, not manually attached.

During a session, the coach/coachee can:
- Unlink an existing active goal from the current session
- Create a new goal and link it to the current session
- Link an existing unlinked goal to the current session

`coaching_sessions_goals` rows are created at **session-creation time** (not lazily). The frontend "create coaching session" flow will need a goal review/management step.

**PR2 interim behavior:** Goals are auto-linked to their originating session only (via `link_to_originating_session()`). Full carry-forward is PR3 scope. The auto-link function has CHANGEME markers for removal.

---

## Q2: Should `goal_id` Be Added to Actions?

> **Decision: Option A (add FK) — confirmed**

### The problem

The frontend shows actions grouped by goal:
- Goal card: `5/8 actions completed`
- Goal detail sheet → Actions tab: all actions for this goal, grouped by status
- Dashboard goals overview: per-goal progress bar

Currently `actions` only has `coaching_session_id`. There is no way to query "all actions for goal X" without fetching all actions and filtering client-side.

### Option A: Add `goal_id` FK to actions (CHOSEN)

```sql
ALTER TABLE actions
  ADD COLUMN goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;
```

**Update endpoints:**
- `GET /actions?goal_id=X` — filter actions by goal
- `GET /users/{user_id}/actions?goal_id=X` — same, user-scoped
- Backend can compute goal-level stats: `SELECT status, COUNT(*) FROM actions WHERE goal_id = X GROUP BY status`

**Pros:**
- Simple, direct FK
- Trivial queries for actions-by-goal
- Enables backend health signal computation (action completion rate is an input)
- Existing actions without a goal simply have NULL
- ON DELETE SET NULL preserves actions when a goal is deleted

**Cons:**
- Another nullable FK on actions
- When creating an action from the notes selection menu, the UI must know which goal to associate it with (or leave it NULL and let the user assign later)

### Option B: Derive through session-goal joins

If Q1 resolves to Option B (join table), actions are linked to sessions, sessions are linked to goals. So: `action → session → coaching_sessions_goals → goal`.

**Problem:** A session can link to multiple goals. Which goal does the action belong to? The association is **ambiguous**. You'd need additional logic (or user input) to disambiguate.

**Verdict:** This doesn't work cleanly. Even with a join table, actions need a direct goal FK to avoid ambiguity.

### Option C: Separate `goal_actions` join table

```sql
CREATE TABLE goal_actions (
  goal_id   UUID REFERENCES goals(id),
  action_id UUID REFERENCES actions(id),
  PRIMARY KEY (goal_id, action_id)
);
```

**When this makes sense:** Only if an action can belong to multiple goals simultaneously. The current UX doesn't show this — each action appears under one goal.

**Verdict:** Over-engineered for current needs. Option A is simpler and sufficient.

---

## Q3: SSE Events for New Entities

> **Decision: Renamed events + two new join table events; health computed synchronously**

### Current SSE event types (being renamed)

```
overarching_goal_created  → goal_created   (invalidates /goals cache)
overarching_goal_updated  → goal_updated   (invalidates /goals cache)
overarching_goal_deleted  → goal_deleted   (invalidates /goals cache)
action_created            → (unchanged)    (invalidates /actions cache)
action_updated            → (unchanged)    (invalidates /actions cache)
action_deleted            → (unchanged)    (invalidates /actions cache)
agreement_created         → (unchanged)    (invalidates /agreements cache)
agreement_updated         → (unchanged)    (invalidates /agreements cache)
agreement_deleted         → (unchanged)    (invalidates /agreements cache)
```

### New SSE events (confirmed)

```
coaching_session_goal_created  → invalidates /coaching_sessions_goals cache
coaching_session_goal_deleted  → invalidates /coaching_sessions_goals cache
```

These are needed so that when coach A links a goal to a session, coachee B (who may have the session open) sees the goal appear in real-time.

### Health signal updates

Health signals are computed **synchronously on read** — no separate SSE event needed. When an action is created/updated/deleted, the `action_*` SSE events trigger cache invalidation. When the frontend re-fetches goal data, the health signal is recomputed as part of the response.

---

## Q4: Note Annotation Persistence

> **Decision: Option C (both SSE + load-time) with per-entity-type validation endpoints**

### The problem

PR 5b will allow users to select text in coaching notes and create a Goal, Action, or Agreement from it. The selected text gets visually annotated (colored inline mark) in the editor, linking it to the created entity.

**Current notes architecture:**
- Coaching notes are **not stored in our database**
- They are Yjs CRDT documents persisted in **TipTap Cloud** (Hocuspocus)
- Each coaching session has one collaborative document, keyed by session ID
- The editor uses TipTap v3 with the `Collaboration` extension
- Content is ProseMirror JSON internally, synced via Yjs

**What the annotation system needs:**
1. Custom TipTap marks (`actionMark`, `agreementMark`, `goalMark`) with an `entityId` attribute
2. When applied, the mark wraps selected text with a colored background and a label (e.g. "Action", "Goal")
3. Marks are persisted automatically by Yjs (they become part of the CRDT document)
4. When the editor reloads, marks render with their styling
5. **Critical:** When the linked entity is deleted from the DB, the mark must be cleaned up (converted back to plain text)

### The stale mark problem

If a user creates an action from selected text (annotating it), then later deletes that action from the Actions tab or the global actions page, the annotation in the notes becomes stale — it references a non-existent entity.

### Chosen strategy: Option C (both SSE + load-time)

**SSE-triggered cleanup (real-time):**
- When an entity is deleted, the SSE event (`action_deleted`, `agreement_deleted`, `goal_deleted`) fires
- The frontend listens for these events and scans the TipTap document for marks with matching `entityId`
- Matching marks are removed (text reverts to plain)
- Handles: "I delete an action while the notes are open"

**Load-time validation (safety net):**
- When a coaching session's notes load, the frontend collects all `entityId` values from marks in the document
- Groups IDs by entity type and validates via per-entity-type endpoints
- Stale marks are removed
- Handles: "entity was deleted while I was offline"

### Validation endpoints (per-entity-type)

Instead of a single cross-entity endpoint, validation uses per-entity-type endpoints:

```
POST /actions/validate
Body: { ids: [UUID, UUID, ...] }
Response: { valid: [UUID, ...], invalid: [UUID, ...] }

POST /agreements/validate
Body: { ids: [UUID, UUID, ...] }
Response: { valid: [UUID, ...], invalid: [UUID, ...] }

POST /goals/validate
Body: { ids: [UUID, UUID, ...] }
Response: { valid: [UUID, ...], invalid: [UUID, ...] }
```

This is a lightweight existence check — no need to return full entities.

---

## Summary of Decisions

| # | Question | Decision | Key Details |
|---|----------|----------|-------------|
| Q1 | Goal scoping model | **Option B: join table** | `goals` table + `coaching_sessions_goals` join table (CASCADE both FKs); `coaching_relationship_id` (NOT NULL, backfill); `created_in_session_id` (nullable); `target_date` (nullable); `DELETE /goals/{id}` ✅ PR2; MAX=3 InProgress per relationship **backend-enforced** (409 Conflict); nested join table routes; auto-link on creation; **auth: Option C** — `GET /goals` requires `coaching_relationship_id`, `by_id` and `by_coaching_session_id` protect middleware |
| Q2 | Goal FK on actions | **Option A: add FK** | Nullable `goal_id` on actions, ON DELETE SET NULL |
| Q3 | SSE events | **Renamed + 2 new** | `goal_*` events, `coaching_session_goal_created/deleted`; health sync on read with dynamic heuristics when `target_date` set |
| Q4 | Annotation cleanup | **Option C: both** | SSE real-time + per-entity-type load-time validation endpoints |

---

## Backend Implementation Plan (5 PRs)

1. **PR1 — Rename:** `overarching_goals` → `goals` (table, API paths, SSE events) — **✅ MERGED**
2. **PR2 — Goal scoping (✅ coordinated deploy completed):** — **✅ MERGED** ([backend #242](https://github.com/refactor-group/refactor-platform-rs/pull/242), [frontend #330](https://github.com/refactor-group/refactor-platform-fe/pull/330))
   - `coaching_relationship_id` (NOT NULL, backfill), `created_in_session_id` (nullable), `target_date` (nullable)
   - `coaching_sessions_goals` join table (CASCADE both FKs, backfill, nested endpoints)
   - `DELETE /goals/{id}` (atomic, with SSE publishing)
   - Active goal limit: max 3 InProgress per relationship (entity_api layer, 409 Conflict)
   - Protect middleware: `by_id`, `by_coaching_session_id`
   - Auto-link on creation when `created_in_session_id` provided
   - Entity helpers: `in_progress()`, `includes_user()`
   - Coding standards: error variant reuse guidance
3. **PR3 — Action FK + carry-forward:** Add nullable `goal_id` to `actions` (ON DELETE SET NULL), add `goal_id` query param. Refactor `batch_load_goals` to use join table. Implement carry-forward workflow
4. **PR4 — SSE events + health:** `coaching_session_goal_created`, `coaching_session_goal_deleted`; health signal computation (synchronous on read) via `GET /goals/{id}/health` returning `GoalHealthMetrics`
5. **PR5 — Validation endpoints:** `POST /actions/validate`, `POST /agreements/validate`, `POST /goals/validate`

PR1 + PR2 are merged. PR3–PR5 can land in parallel with frontend Layer 3+ work.

---

## What the Frontend Needs from the Backend (Summary)

1. **PR1:** ✅ Rename `overarching_goals` → `goals` (table, API paths, SSE events)
2. **PR2:** ✅ Relationship scoping, join table with nested endpoints, `DELETE /goals/{id}`, active goal limit (409), auto-link on creation, protect middleware
3. **PR3:** Add nullable `goal_id` FK to `actions` (ON DELETE SET NULL), add `goal_id` query param on `GET /actions` and `GET /users/{id}/actions`. Carry-forward workflow (auto-link active goals on session creation). Refactor `batch_load_goals` to use join table
4. **PR4:** SSE events for join table (`coaching_session_goal_created`, `coaching_session_goal_deleted`) + health signal computation (synchronous on read) via `GET /goals/{id}/health` returning `GoalHealthMetrics` (dynamic heuristics when `target_date` set, momentum-only when null)
5. **PR5:** Per-entity-type validation endpoints: `POST /actions/validate`, `POST /agreements/validate`, `POST /goals/validate`
6. **Carry-forward workflow (PR3 scope):** Active goals auto-linked to new sessions at creation time; frontend needs goal review/management step in session creation flow
