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
| DELETE | `/overarching_goals/{id}` | — | **Not in OpenAPI spec — does this exist?** |

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
- Cannot enforce per-session goal limit (MAX=3) at the DB level
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

-- Add relationship scoping
ALTER TABLE goals
  ADD COLUMN coaching_relationship_id UUID REFERENCES coaching_relationships(id);

-- New join table for explicit session-goal links
CREATE TABLE coaching_sessions_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coaching_session_id UUID NOT NULL REFERENCES coaching_sessions(id),
  goal_id         UUID NOT NULL REFERENCES goals(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coaching_session_id, goal_id)
);
```

**New endpoints needed:**
```
POST   /coaching_sessions_goals          — Link a goal to a session
DELETE /coaching_sessions_goals/{id}     — Unlink a goal from a session
GET    /coaching_sessions/{id}/goals     — List goals linked to a session
GET    /goals/{id}/sessions              — List sessions that discussed a goal
```

**Pros:**
- Explicit tracking of which sessions discussed which goals
- Can enforce MAX=3 goals per session (check count before insert)
- Enables the goal drawer UX: link/unlink goals per session
- Goal detail timeline is a direct query on the join table
- `created_in_session_id` on `goals` remains as "originating session"

**Cons:**
- More complex schema (new table, new endpoints, new CRUD)
- More SSE events to emit (`coaching_session_goal_created`, `coaching_session_goal_deleted`)
- Migration needs to populate `coaching_relationship_id` for existing goals (derive from `coaching_sessions.coaching_relationship_id`)

**Frontend impact:**
- (a) list all goals for a relationship: `GET /goals?coaching_relationship_id=X` — works
- (b) list goals linked to a specific session: `GET /coaching_sessions/{id}/goals` — direct query
- (c) link/unlink a goal from a session: `POST/DELETE /coaching_sessions_goals` — direct
- (d) know which sessions discussed a goal: `GET /goals/{id}/sessions` — direct query

### Additional decisions made alongside Q1

- **Table rename:** `overarching_goals` → `goals` (simpler, matches UX terminology)
- **Column rename:** `coaching_session_id` → `created_in_session_id` on goals (clarifies purpose)
- **Join table name:** `coaching_sessions_goals` (plural "sessions")
- **Join table FK:** `goal_id` (not `overarching_goal_id`)

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
| Q1 | Goal scoping model | **Option B: join table** | `goals` table + `coaching_sessions_goals` join table; `created_in_session_id` column |
| Q2 | Goal FK on actions | **Option A: add FK** | Nullable `goal_id` on actions, ON DELETE SET NULL |
| Q3 | SSE events | **Renamed + 2 new** | `goal_*` events, `coaching_session_goal_created/deleted`; health sync on read |
| Q4 | Annotation cleanup | **Option C: both** | SSE real-time + per-entity-type load-time validation endpoints |

---

## Backend Implementation Plan (5 PRs)

The backend team has committed to the following PR sequence:

1. **PR1 — Rename:** `overarching_goals` → `goals` (table, API paths, SSE events)
2. **PR2 — Goal scoping:** Add `coaching_relationship_id`, rename `coaching_session_id` → `created_in_session_id`, create `coaching_sessions_goals` join table with CRUD
3. **PR3 — Action FK:** Add nullable `goal_id` to `actions` (ON DELETE SET NULL), add `goal_id` query param
4. **PR4 — SSE events:** `coaching_session_goal_created`, `coaching_session_goal_deleted`
5. **PR5 — Validation endpoints:** `POST /actions/validate`, `POST /agreements/validate`, `POST /goals/validate`

Frontend Layer 2 can begin after PR1 + PR2 are merged. PR3–PR5 can land in parallel with early frontend work.

---

## What the Frontend Needs from the Backend (Summary)

1. **PR1:** Rename `overarching_goals` → `goals` (table, API paths `/overarching_goals` → `/goals`, SSE events `overarching_goal_*` → `goal_*`)
2. **PR2:** Add `coaching_relationship_id` to `goals`, rename `coaching_session_id` → `created_in_session_id`, create `coaching_sessions_goals` join table with CRUD endpoints
3. **PR2:** New query params: `status` and `coaching_relationship_id` on `GET /users/{id}/goals`
4. **PR3:** Add nullable `goal_id` FK to `actions` (ON DELETE SET NULL), add `goal_id` query param on `GET /actions` and `GET /users/{id}/actions`
5. **PR4:** SSE events for join table: `coaching_session_goal_created`, `coaching_session_goal_deleted`
6. **Backend-computed health signal:** `GoalHealth` enum returned on goal responses (computed synchronously on read)
7. **Goal summary endpoint:** `GET /goals/{id}/summary` returning action counts, session count, health signal
8. **PR1:** Verify/add `DELETE /goals/{id}`
9. **PR5:** Per-entity-type validation endpoints: `POST /actions/validate`, `POST /agreements/validate`, `POST /goals/validate`
