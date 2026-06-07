# Master Plan — Coaching Session Title + Topics (Frontend)

> **You are the overseer** for this build, operating under the `overseer-handoff-workflow`
> skill (`~/.claude/skills/overseer-handoff-workflow`). Read that skill first. Your job:
> own this plan, decompose it into phases, write **one self-contained handoff per phase**
> for a fresh implementer agent, then **independently review** each finished phase
> (re-run gates, read the diff, reproduce claims). **You do not implement phases yourself**
> unless the human explicitly tells you to — staying out of the build is what keeps your
> review independent. Keep this doc current as decisions change (committed living plan).
> Per-phase handoffs live in `.overseer-handoffs/` (gitignored, throwaway).

## What this feature is

Give a coaching session an optional, human-authored **Title**, plus a collaborative,
reorderable set of **Topics** that either party can contribute, each carrying a coachee-set
**relevance** and **immediacy** rating. The Title replaces today's practice of borrowing the
first linked goal's title as the session's display name (the goal stays a fallback).

## Sources of truth (read these before planning a phase)

1. **Interactive prototype (the UX source of truth):**
   `src/app/prototype/session-title-topics/page.tsx`. It is **on disk but gitignored**
   (prototype `page.tsx` files are gitignored; see `.gitignore`), so a fresh agent must be
   told to open it — it won't appear in git. Run the app and visit
   `/prototype/session-title-topics` to interact with it. It is mock/local-state only.
2. **GitHub issues (the contract + definition of done):**
   - Epic (source of truth): `refactor-group/refactor-platform-fe#412`
   - FE stories: `#413` (Title + fallback) · `#414` (Topics CRUD + reorder) · `#415` (Phase 2 rating)
   - FE backlog: `#416` (Phase 3 — 2×2 matrix + coach-side immediacy) · `#417` (Phase 4 — LLM auto-title)
   - Backend (NOT yet implemented): `refactor-group/refactor-platform-rs#346/#347/#348`; authz extractor pattern `#218`
3. **Project memory:** `project_coaching_session_title_topics.md` (decisions + issue map) and
   the `.claude/CLAUDE.md` / `.claude/coding-standards.md` files.

## Locked UX/design decisions (validated against the prototype)

- **Title = Option A**: the title is the session's **primary heading**; participants + presence
  dots + date become the subtitle. Click-to-edit (inline desktop / nothing fancy). When unset,
  show the **fallback** (first linked goal's title → `"Coaching Session"`) in muted text with a
  subtle "add a title" affordance.
- **Topics live in the existing panel `Select` switcher** (the one in
  `src/components/ui/coaching-sessions/coaching-session-panel-selector.tsx`, currently
  Goals/Agreements/Actions) as a **new default section** — NOT a separate stacked panel. Notes
  stays its own panel below.
- **Topic row**: drag handle (reorder) · author avatar · body (click text to edit; inline on
  desktop, bottom `Sheet` on mobile) · two rating chips · author-only **delete** (grey trash on
  hover desktop / in the edit sheet on mobile). Long body **wraps up to 3 lines** (`line-clamp-3`).
- **Rating = two labeled chips + popover** (pips were tried and rejected). Each chip is a
  colored icon that **expands on click** (not hover) and opens a popover: a chooser for the
  **coachee**, read-only for the **coach**. Clicking the already-selected level **clears** it
  (no separate "Clear" item). Color-tinted by level (relevance = indigo/★, immediacy = amber/🕐),
  dashed "ghost" when unrated. Popover header has a subtitle: relevance →
  "How relevant is this topic to you today?"; immediacy → "How soon does this topic need our
  attention?". Chips column-align (fixed icon size) and free up the row's horizontal space.
- **Provenance**: a HoverCard on the author avatar shows the author **name** (no role label —
  only two people, they know their roles), `Added <relative>` and `Updated <relative>` (the
  "Updated" line shows only when `updated_at` ≠ `created_at`). Label it **"Updated," never
  "Edited"** — `updated_at` is coarse (any mutation, incl. reorder/rating, bumps it).
- **"New since last session" dot**: a small **violet** dot at the top-right of the avatar for
  topics created after the previous session **by the other party**, with an `sr-only`
  "New since your last session" label and `ring-2 ring-card`. Accessibility comes from
  presence + position + text, not hue (so swapping the color is free; `bg-primary`/rose are
  fallbacks if violet reads too close to the indigo relevance chip).
- **Permissions**: add / edit / reorder by **either** party; **delete is author-only**; **rating
  is coachee-only** (coach sees read-only).

## Data model

### `CoachingSessionTopic` (new entity, nested under a coaching session)

| Field | FE type | Notes |
|---|---|---|
| `id` | `Id` | |
| `coaching_session_id` | `Id` | FK |
| `user_id` | `Id` | author |
| `body` | `string` | |
| `relevance` | `TopicRelevance` (enum, **non-null**, default `Neutral`) | coachee-set |
| `immediacy` | `TopicImmediacy` (enum, **non-null**, default `Neutral`) | coachee-set |
| `created_at` | `DateTime` (ts-luxon) | |
| `updated_at` | `DateTime` (ts-luxon) | bumped by ANY mutation |

- **`display_order` is backend-internal — it is NOT a field on the FE type and never crosses
  the wire.** Order is conveyed by **array position**: every read path returns topics
  **pre-sorted**; reorder is a **whole-list** operation (FE sends the full ordered list of
  topic ids).
- **Enums are TS string enums** (mirror `ItemStatus` in `src/types/general.ts`), wire values in
  snake_case to match Rust serde: `TopicRelevance { Neutral="neutral", Background="background",
  WorthExploring="worth_exploring", Central="central" }`; `TopicImmediacy { Neutral="neutral",
  CanWait="can_wait", Soon="soon", Pressing="pressing" }`. Display labels are TBD and live in
  the UI, separate from the enum values.

### `CoachingSession.title`

Add `title: Option<string>` (from `src/types/option.ts` — `Some`/`None`, **never** `string | null`).
Normalize at the fetch boundary: raw wire `title` (`string | null | undefined`) → `Some(title)`
when non-empty, else `None`.

### Planned endpoints (backend, not yet built — type against these)

- `GET  /coaching_sessions/{id}/topics` → topics, pre-sorted
- `POST /coaching_sessions/{id}/topics` → create
- `PUT  /coaching_sessions/{id}/topics/{topic_id}` → update body
- `DELETE /coaching_sessions/{id}/topics/{topic_id}` → delete (author-only, BE-enforced)
- `PATCH /coaching_sessions/{id}/topics/reorder` with `{ topic_ids: Id[] }` → bulk reorder
- rating write (coachee-only, BE-enforced): `PATCH /coaching_sessions/{id}/topics/{topic_id}`
  (or a dedicated rating sub-route) carrying `{ relevance?, immediacy? }` — confirm the shape
  with the BE issue #348 / coordination board before Phase wiring; for now type both axes on the
  update payload.

## Backend status & verification strategy

The backend (`refactor-platform-rs`) is **not implemented yet**. This build is **FE-first**:
the `CoachingSessionTopic` API is written against the planned endpoints above but **cannot be
verified against a live backend**. Therefore, for every phase:

- Gates are **`npx tsc --noEmit`** (preferred over `npm run build` for dev — see memory) and the
  **Vitest** suite. The project mocks the network with **MSW** (`src/test-utils/setup.ts`;
  factories in `__tests__/test-utils.ts`).
- API-layer correctness is proven by **MSW-mocked unit tests** that assert the right URL, method,
  request body shape, and response parsing — not by hitting a real server.
- The usual "verify against a running backend before commit" rule is **suspended until the BE
  exists**; record that as a known gap. When the BE lands, a later phase re-verifies end-to-end.

## Testing discipline — TDD + frozen acceptance tests

This build is **test-first**. For each phase, the **overseer writes the acceptance tests
before** the implementer builds it (capturing the contract as assertions), then **locks them
read-only (`chmod 0444`)** so no implementer can weaken a test to fit the code. The frozen
tests ARE the spec; the implementer makes them pass without touching them.

**Phase 1 frozen tests (already written + locked `0444`):**
- `__tests__/types/coaching-session-topic.test.ts`
- `__tests__/lib/api/coaching-session-topics.test.ts`

They currently **fail (red)** — they import `@/types/coaching-session-topic` and
`@/lib/api/coaching-session-topics`, which don't exist yet. That red state is intended (TDD).
Phase 1 turns them green by creating exactly those modules. **Note: until Phase 1 lands, the
whole `tsc`/Vitest run is red** because of these imports — expected, not a regression.

**Rules (enforced):**
- An **implementer may not edit any read-only test**. If a frozen test looks genuinely wrong
  (a harness/spec bug, not merely inconvenient), the implementer **STOPS and reports** to the
  overseer — it does not work around it.
- **Only the overseer unlocks** a frozen test (`chmod +w`), and only to fix a real spec/harness
  error — **never** to make a failing implementation pass. Re-lock (`chmod 0444`) immediately after.
- Before each future phase, the overseer writes + freezes that phase's acceptance tests where
  feasible, and lists the frozen files in the handoff's freeze list.
- **At the very end** of the whole build (final phase approved), restore all frozen tests to
  writable (`chmod +w`) so they can be maintained normally.

Gates every phase: `npx tsc --noEmit` and `npm run test:run` (Vitest; MSW per
`src/test-utils/setup.ts`).

## Conventions (enforced in review — see `.claude/coding-standards.md` + `.claude/style-guide.md`)

- **Visual style:** every UI-bearing phase (3–5) follows `.claude/style-guide.md` — the project's
  frontend visual language (neutral shadcn tokens, flat `border shadow-none` cards, quiet
  hover-revealed affordances, `tabular-nums`, hue-never-the-only-signal). It's a standing review
  gate, not optional polish. Feature-scoped accent hues (relevance = indigo, immediacy = amber,
  "new" dot = violet) live in this feature; do **not** repaint the global neutral `primary` token.
- `Option<T>` for presence/absence (no `T | null`/`T | undefined`); **TS enums** for fixed-set
  status; discriminated unions for variant state.
- Name it `coaching_session`/`CoachingSession*`, never abbreviated `session` (disambiguates from
  user login sessions).
- Small, focused functions/components (story-like flow); terse comments (default none).
- **No Claude attribution** in commits or PRs. Never `git add -A` — stage files by name.
- Work on a **feature branch** (current branch is `prototype/...`; the overseer creates
  `feature/coaching-session-title-topics` off `main` before Phase 1).

## Phase plan (living — update as you go)

- **Step 0 — Visual style guide (cross-cutting; established mid-Phase-1).** Author
  `.claude/style-guide.md` (linked from `.claude/CLAUDE.md` like `coding-standards.md`): the
  project's frontend visual language, grounded in the live theme (`src/styles/globals.css`,
  `tailwind.config.ts`) and the shipped dashboard (`src/components/ui/dashboard/**`), with the
  north-star reference dashboard's observed-vs-adopted idioms made explicit. **Not** a numbered
  feature phase and **not** a gate on the data-layer phases (1–2); it is the standing acceptance
  gate the overseer checks every **UI** phase (3–5) against. Living doc — grows over time.
- **Phase 1 — Types + stubbed API foundation (NEW FILES ONLY).** Create
  `src/types/coaching-session-topic.ts` (`CoachingSessionTopic` type + `TopicRelevance`/
  `TopicImmediacy` enums + `defaultCoachingSessionTopic` + `transformCoachingSessionTopic`) and
  `src/lib/api/coaching-session-topics.ts` (`CoachingSessionTopicApi` EntityApi child:
  list/create/update/delete/reorder + SWR hooks), mirroring `AgreementApi`/`GoalApi`. **No edits
  to existing types/components; no UI wiring** — keeps the phase isolated and additive. Done =
  the two frozen acceptance tests above pass + `tsc` clean + suite green. Handoff:
  `.overseer-handoffs/phase-1-types-and-api.md`.
  **✅ DONE — commit `feefe41f` (3 new files only).** Independently reviewed by the overseer:
  `tsc --noEmit` clean; frozen tests green (3 files / 18 tests); full suite 124 files / 1383
  tests; lint 0 errors (7 pre-existing warnings, none in new files); frozen files byte-identical
  + still `0444`. **Follow-up (known gap):** `CoachingSessionTopicApi.reorder` propagates the raw
  axios error (no `EntityApiError` wrapping, since `entity-api.ts` was out of scope) — revisit
  when wiring reorder UI (Phase 3) or when the BE lands.
- **Phase 2 — Title field + `coachingSessionTitle()` fallback.** Add
  `CoachingSession.title: Option<string>` (`src/types/coaching-session.ts`) and normalize the raw
  wire `title` (`string | null | undefined`) → `Some`/`None` at the fetch boundary (update
  `defaultCoachingSession` → `None`). Then the helper (title → first goal → "Coaching Session"),
  migrate the goal-as-title call sites (`join-session-popover.tsx`, `coaching-session-selector.tsx`,
  `lib/utils/session.ts` + `session-display.ts`), and the editable title header (Option A). Leave
  goal-based *action grouping* (`assigned-actions.ts`) untouched. (Title moved here from Phase 1 so
  Phase 1 stays new-files-only.)
- **Phase 3 — Topics section in the panel switcher.** Add `Topics` to `PanelSection` (default);
  build the section content (list, add inline/sheet, edit, author-only delete, drag-reorder via
  `@dnd-kit/core` + `DragOverlay`), wired to the Phase 1 hooks (optimistic where the prototype is).
- **Phase 4 — Rating chips + popover.** Coachee-set relevance/immediacy; coach read-only; click-
  to-expand popover with toggle-to-clear; the subtitles above.
- **Phase 5 — Provenance HoverCard + "new since last session" dot.** As specced above.
- **Later (post-BE):** end-to-end verification against the real backend; Phase 3/4 backlog (#416,
  #417). Coordinate wire format with the BE via the issues / coordination board.

Sequencing note: Phases 2 and 3 both consume Phase 1's types/hooks and are independent of each
other; either can follow Phase 1. Rating (4) and provenance (5) layer onto the Phase 3 row.

## The loop (per phase)

1. Plan the next phase slice; **write + freeze (`chmod 0444`) that phase's acceptance tests**
   where feasible, then write its handoff into `.overseer-handoffs/` (self-contained, role-framed;
   list the frozen files — see `~/.claude/skills/overseer-handoff-workflow/handoff-template.md`).
2. Human spawns a fresh implementer with that handoff; implementer does ONE phase, commits, reports
   back, STOPS.
3. You **independently review** (`review-checklist.md`): re-run `tsc` + tests yourself, read the
   full diff (`git show --stat`), confirm only intended files changed, confirm tests have teeth.
   For **UI phases (3–5)**, also check the diff against `.claude/style-guide.md` (tokens not raw
   hex, flat `border shadow-none` cards, `tabular-nums`, quiet affordances, hue-never-alone).
4. Human approves (or you send it back). Update this plan + memory; write the next handoff.
