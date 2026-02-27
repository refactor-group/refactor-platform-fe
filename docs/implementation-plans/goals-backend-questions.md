# Goals Feature — Backend Planning Questions

**Purpose:** This document provides the context needed to resolve four architectural questions with the backend team. Answers to these questions block all frontend implementation work. Bring this to a backend planning session with Claude and a team member.

**Frontend master plan:** `docs/implementation-plans/goals-feature-master-plan.md`

---

## Current State

### What exists today

**Database schema (`overarching_goals` table):**
```
id                  UUID (PK)
coaching_session_id UUID (FK → coaching_sessions)
user_id             UUID (FK → users)
title               TEXT (nullable)
body                TEXT (nullable)
status              ItemStatus enum (NotStarted | InProgress | Completed | WontDo)
status_changed_at   TIMESTAMPTZ
completed_at        TIMESTAMPTZ
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

**Existing API endpoints for overarching goals:**

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
- (a) list all goals for a relationship: `GET /overarching_goals?coaching_relationship_id=X` — works
- (b) list goals linked to a specific session: **Cannot do directly** — would need to infer from actions or other data
- (c) link/unlink a goal from a session: **Not possible** — goals exist at the relationship level
- (d) know which sessions discussed a goal: **Indirect only** — infer from actions created in those sessions

### Option B: Many-to-many join table

```sql
-- Keep coaching_relationship_id on overarching_goals for relationship scoping
ALTER TABLE overarching_goals
  ADD COLUMN coaching_relationship_id UUID REFERENCES coaching_relationships(id);

-- New join table for explicit session-goal links
CREATE TABLE coaching_session_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coaching_session_id UUID NOT NULL REFERENCES coaching_sessions(id),
  overarching_goal_id UUID NOT NULL REFERENCES overarching_goals(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coaching_session_id, overarching_goal_id)
);
```

**New endpoints needed:**
```
POST   /coaching_session_goals          — Link a goal to a session
DELETE /coaching_session_goals/{id}     — Unlink a goal from a session
GET    /coaching_sessions/{id}/goals    — List goals linked to a session
GET    /overarching_goals/{id}/sessions — List sessions that discussed a goal
```

**Pros:**
- Explicit tracking of which sessions discussed which goals
- Can enforce MAX=3 goals per session (check count before insert)
- Enables the goal drawer UX: link/unlink goals per session
- Goal detail timeline is a direct query on the join table
- `coaching_session_id` on `overarching_goals` remains as "originating session"

**Cons:**
- More complex schema (new table, new endpoints, new CRUD)
- More SSE events to emit (`coaching_session_goal_created`, `coaching_session_goal_deleted`)
- Migration needs to populate `coaching_relationship_id` for existing goals (derive from `coaching_sessions.coaching_relationship_id`)

**Frontend impact:**
- (a) list all goals for a relationship: `GET /overarching_goals?coaching_relationship_id=X` — works
- (b) list goals linked to a specific session: `GET /coaching_sessions/{id}/goals` — direct query
- (c) link/unlink a goal from a session: `POST/DELETE /coaching_session_goals` — direct
- (d) know which sessions discussed a goal: `GET /overarching_goals/{id}/sessions` — direct query

### Decision needed

Which option? If Option B, should the join table also carry any metadata (e.g. a `notes_snippet` field for what was discussed about the goal in that session)?

---

## Q2: Should `overarching_goal_id` Be Added to Actions?

### The problem

The frontend shows actions grouped by goal:
- Goal card: `5/8 actions completed`
- Goal detail sheet → Actions tab: all actions for this goal, grouped by status
- Dashboard goals overview: per-goal progress bar

Currently `actions` only has `coaching_session_id`. There is no way to query "all actions for goal X" without fetching all actions and filtering client-side.

### Option A: Add `overarching_goal_id` FK to actions

```sql
ALTER TABLE actions
  ADD COLUMN overarching_goal_id UUID REFERENCES overarching_goals(id);
```

**Update endpoints:**
- `GET /actions?overarching_goal_id=X` — filter actions by goal
- `GET /users/{user_id}/actions?overarching_goal_id=X` — same, user-scoped
- Backend can compute goal-level stats: `SELECT status, COUNT(*) FROM actions WHERE overarching_goal_id = X GROUP BY status`

**Pros:**
- Simple, direct FK
- Trivial queries for actions-by-goal
- Enables backend health signal computation (action completion rate is an input)
- Existing actions without a goal simply have NULL

**Cons:**
- Another nullable FK on actions
- When creating an action from the notes selection menu, the UI must know which goal to associate it with (or leave it NULL and let the user assign later)

### Option B: Derive through session-goal joins

If Q1 resolves to Option B (join table), actions are linked to sessions, sessions are linked to goals. So: `action → session → coaching_session_goals → goal`.

**Problem:** A session can link to multiple goals. Which goal does the action belong to? The association is **ambiguous**. You'd need additional logic (or user input) to disambiguate.

**Verdict:** This doesn't work cleanly. Even with a join table, actions need a direct goal FK to avoid ambiguity.

### Option C: Separate `goal_actions` join table

```sql
CREATE TABLE goal_actions (
  overarching_goal_id UUID REFERENCES overarching_goals(id),
  action_id UUID REFERENCES actions(id),
  PRIMARY KEY (overarching_goal_id, action_id)
);
```

**When this makes sense:** Only if an action can belong to multiple goals simultaneously. The current UX doesn't show this — each action appears under one goal.

**Verdict:** Over-engineered for current needs. Option A is simpler and sufficient.

### Decision needed

Option A (add `overarching_goal_id` FK to actions) seems like the clear choice, but confirming: is there any reason an action might need to belong to multiple goals?

---

## Q3: SSE Events for New Entities

### Current SSE event types

```
overarching_goal_created  → invalidates /overarching_goals cache
overarching_goal_updated  → invalidates /overarching_goals cache
overarching_goal_deleted  → invalidates /overarching_goals cache
action_created            → invalidates /actions cache
action_updated            → invalidates /actions cache
action_deleted            → invalidates /actions cache
agreement_created         → invalidates /agreements cache
agreement_updated         → invalidates /agreements cache
agreement_deleted         → invalidates /agreements cache
```

### New SSE events needed

**If Q1 resolves to Option B (join table):**
```
coaching_session_goal_created  → invalidates /coaching_session_goals cache
coaching_session_goal_deleted  → invalidates /coaching_session_goals cache
```

These are needed so that when coach A links a goal to a session, coachee B (who may have the session open) sees the goal appear in real-time.

**For health signal updates:**

If health signals are recomputed asynchronously (e.g. on a schedule or triggered by action status changes), a new event type would be useful:
```
overarching_goal_health_updated → invalidates goal health/summary cache
```

Alternatively, if health is computed on every goal read (synchronous), the existing `overarching_goal_updated` event is sufficient since any action change that affects health would also trigger cache invalidation through the action events.

### Decision needed

- Will health signals be computed synchronously (on read) or asynchronously (on write/schedule)?
- If Q1 = Option B, confirm the two new SSE event types above.

---

## Q4: Note Annotation Persistence

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

**Option A: SSE-triggered cleanup**
- When an entity is deleted, the existing SSE event (`action_deleted`, `agreement_deleted`, `overarching_goal_deleted`) fires
- The frontend listens for these events and scans the TipTap document for marks with matching `entityId`
- Matching marks are removed (text reverts to plain)
- **Pro:** Real-time cleanup, even if the note is open in another tab
- **Con:** Requires the editor to be loaded and connected; cleanup only happens while the session is open

**Option B: Load-time validation**
- When a coaching session's notes load, the frontend collects all `entityId` values from marks in the document
- It batch-validates them against the backend: `POST /validate-entity-ids { ids: [...] }` → returns which ones still exist
- Stale marks are removed
- **Pro:** Works regardless of whether the user was online when the entity was deleted
- **Con:** Requires a new backend endpoint; adds latency on editor load; doesn't handle real-time deletions

**Option C: Both**
- SSE cleanup for real-time (handles the "I delete an action while the notes are open" case)
- Load-time validation as a safety net (handles the "entity was deleted while I was offline" case)
- **Pro:** Complete coverage
- **Con:** Most complex implementation

### Additional backend considerations

If we go with Option B or C, the backend needs a new endpoint:
```
POST /entities/validate
Body: { entity_ids: [{ id: UUID, type: "action" | "agreement" | "overarching_goal" }] }
Response: { valid: [...], invalid: [...] }
```

This is a lightweight existence check — no need to return full entities.

### Decision needed

- Which cleanup strategy: A (SSE only), B (load-time only), or C (both)?
- If B or C: is a `/entities/validate` endpoint acceptable, or should validation be done per-entity-type with existing endpoints?

---

## Summary of Decisions Needed

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| Q1 | Goal scoping model | A: relationship column, B: join table | B (join table) — enables the full UX |
| Q2 | Goal FK on actions | A: add FK, B: derive, C: join table | A (add FK) — simplest, unambiguous |
| Q3 | New SSE events | Depends on Q1 answer | If Q1=B: two new events for session-goal link/unlink |
| Q4 | Annotation cleanup | A: SSE, B: load-time, C: both | C (both) — complete coverage |

These recommendations are from the frontend perspective. The backend team should weigh implementation complexity and performance implications.

---

## What the Frontend Needs from the Backend (Summary)

Once decisions are made, here is the minimum set of backend changes needed before frontend Layer 2 can begin:

1. **Schema migration:** Add `coaching_relationship_id` to `overarching_goals` (+ join table if Q1=B)
2. **Schema migration:** Add `overarching_goal_id` to `actions` (if Q2=A)
3. **New query params:** `status` and `coaching_relationship_id` on `GET /users/{id}/overarching_goals`
4. **New query param:** `overarching_goal_id` on `GET /actions` and `GET /users/{id}/actions`
5. **New endpoints** (if Q1=B): CRUD for `coaching_session_goals`
6. **Health signal computation:** Backend-computed `GoalHealth` enum returned on goal responses
7. **Goal health metrics endpoint:** `GET /overarching_goals/{id}/health_metrics` returning action counts, session count, health signal
8. **Verify/add:** `DELETE /overarching_goals/{id}`
9. **New SSE events** for any new entities/relationships
10. **Entity validation endpoint** (if Q4=B or C): `POST /entities/validate`
