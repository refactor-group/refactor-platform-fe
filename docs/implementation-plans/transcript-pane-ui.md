# Transcript Pane UI Implementation Plan

**Date:** 2026-04-19
**Feature:** iOS-style read-only meeting transcript view for coaching sessions
**Backend dependency:** [refactor-platform-rs#254](https://github.com/refactor-group/refactor-platform-rs/pull/254) (`ai-transcription-milestone-2`)
**Scope:** Frontend UI only. Backend integration is finished end-to-end by Caleb as part of his backend PR; if the backend contract shifts during that work, he will update the frontend code accordingly.

---

## Summary

Add a docked read-only transcript pane to the coaching session page so coaches can review what was said during a meeting while writing notes. The pane uses iMessage-style speaker bubbles, client-side phrase search with match navigation, a speaker filter, and a per-bubble copy action. Meeting recording controls live inside the pane's empty state (pre/post recording) and as a status indicator on the transcript toggle icon (during active recording).

This plan is the output of a prototype exploration on `feature/146-ai-meeting-integration-testing` under `src/app/prototype/transcript-proposed/`. The prototype is the source of truth for visual and interaction behavior.

## Goals

- Give coaches searchable, filterable access to the verbatim conversation alongside Notes.
- Keep Notes visible while reviewing the transcript — reading and writing are adjacent tasks, not alternating modes.
- Integrate recording start/stop as a natural extension of "there's no transcript yet" rather than adding header chrome.
- Ship as a polished v1 that Caleb can wire to real data without touching UI structure.

## Non-goals (v1)

- Cross-session transcript search
- Timestamp → video seek / recording playback
- "Add selection as note/action" (deferred — its own design problem)
- AND / OR / regex search operators
- Virtualization (defer until data shows transcripts routinely exceed ~10k lines)
- Persistent speaker label mapping (Caleb may add in backend; UI shows raw labels for now)
- Feature flag gating

---

## Placement and layout

### Page-level structure

The coaching session page grows from two columns to three. Columns collapse cleanly to match whichever content is active:

```
Default (no transcript open):
  [ Goals 300px | Notes 1fr ]

Transcript open:
  [ Goals rail 40px | Transcript <user-width, default 440px> | Notes 1fr ]

Transcript maximized:
  [ Goals rail 40px | Transcript 1fr ]

Notes maximized:
  [ Goals rail 40px | Notes 1fr ]
```

- Transcript sits **left of Notes**, not right. The coach's eye moves left-to-right from source (transcript) to synthesis (Notes), matching the reading-to-writing flow.
- Opening the transcript auto-collapses Goals to its thin vertical rail. The rail remains visible so Goals is always one click away.
- Grid template uses `minmax(0,1fr)` for both rows and the Notes column — required for internal scrolling (plain `1fr` stretches to content height and breaks the overflow container).
- Below `lg:` (1024px), the three-column layout is replaced with a full-width sheet that slides in over Notes, reusing the mobile sheet pattern from [coaching-session-panel-mobile.tsx](../../src/components/ui/coaching-sessions/coaching-session-panel-mobile.tsx).
- In the 3-column docked view, the boundary between transcript and Notes is a drag handle. See **Resizable transcript/notes split** under Phase 1.

### Focus mode

Replaces the existing `notesMaximized: boolean` on the coaching session page with a single enum-valued state:

```ts
enum FocusedPane {
  None = "none",
  Notes = "notes",
  Transcript = "transcript",
}
```

Maximizing one auto-exits the other. Maximizing the transcript hides Notes but keeps the Goals rail. Maximizing Notes hides the transcript (if open) and keeps the Goals rail. This is modelled as a single state because "both maximized" is not a coherent layout.

### URL state

Deep-linkable via query params, synced with `router.replace` (no scroll):

| Param | Meaning |
|---|---|
| `?panel=goals\|agreements\|actions` | Existing — active panel section |
| `?transcript=1` | Transcript pane is open |
| `?focus=notes\|transcript` | Active focused/maximized pane |

Absence of a param is the default (transcript closed, no focus).

---

## Transcript trigger

A `FileText` icon button sits in the session header to the right, grouped with `JoinMeetLink` and `ShareSessionLink`. This location reads as "things related to the meeting" — Video, Transcript, Share.

### Status indicator dot

A small circular indicator on the icon communicates recording/transcript state at a glance. Only three visual states exist:

| State | Indicator |
|---|---|
| `meeting_recording.status === "recording"` | Slow-pulsing red dot (~1Hz) |
| `transcription.status === "completed"` | Solid green dot |
| Either status is `"failed"` | Small `!` warning glyph (no color as sole signal) |
| Any other state | No indicator |

### Accessibility and motion

- Respect `prefers-reduced-motion`: swap the pulse for a steady red fill. Color alone still communicates "live."
- Tooltip always provides the authoritative text: *"Recording in progress · 12:34"*, *"Generating transcript…"*, *"Transcript ready"*, *"Recording failed."*
- Clicking the icon at any state opens the transcript pane. The pane is mission control for the recording lifecycle.

---

## Transcript pane composition

The pane is an orchestrator that assembles focused subcomponents. Each subcomponent does one thing; the pane's body reads top-to-bottom like a short story.

```
TranscriptPane                     ← state + data, no rendering logic of its own
├── TranscriptPaneHeader           ← title, duration, Copy-all, Maximize, Close
├── TranscriptSearch               ← input + match counter + prev/next + clear
├── TranscriptSpeakerFilter        ← segmented All / <coach> / <coachee>
├── TranscriptBody                 ← scroll container, renders bubbles
│   └── TranscriptBubble           ← single bubble: header (name, time, copy) + text
└── TranscriptEmptyState           ← variants: no-recording / processing / failed / in-progress / no-meeting
```

### Bubble styling

- Coach → right-aligned, `bg-[#007AFF]` iOS blue, white text, `rounded-[18px]` with `rounded-br-[6px]` tail on the last bubble of a group.
- Coachee → left-aligned, `bg-white`, foreground text, `border border-zinc-200 dark:border-zinc-700` (stronger than the earlier `black/[0.04]` which was too faint against the card background), tail on `rounded-bl-[6px]`.
- Grouping is computed against the **original transcript adjacency**, not the filtered list. Consecutive same-speaker turns collapse in the unfiltered view; filtered views show a header on every bubble because the turns are no longer contiguous in time.

### Bubble header

Shows speaker label + timestamp + per-bubble copy action. The copy icon is hidden until the bubble is hovered (`group-hover:opacity-100`), clicks copy `{speaker_label}: {text}` as plain text, and swaps to a `Check` icon for ~1.2s as feedback. An `aria-live="polite"` region announces "Copied" for screen readers.

### Speaker labels in v1

Display raw labels as returned by the backend (e.g. `"Speaker A"`, `"Speaker B"`). Caleb's backend PR may later map these to user identities; if so, he updates the frontend to consume the mapped labels.

The segmented speaker filter derives its chip labels from the first occurrence of each speaker in the transcript data, so it generalizes automatically once mapped labels arrive.

---

## Search

Phrase search, client-side, navigate-mode (matches are highlighted in place, not filtered out). Behavior:

- Regex built from the trimmed query with metacharacters escaped; case-insensitive (`i` flag).
- Empty/whitespace queries short-circuit to zero matches.
- Match counter shows `n/total`; `↑` / `↓` buttons and `Enter` / `Shift+Enter` navigate between matches.
- Active match is more strongly highlighted than inactive matches (`bg-amber-300` vs `bg-yellow-200`).
- Scrolling to the active match is **scoped to the transcript container** — never bubble up to the page. Implemented with manual `container.scrollBy` calculation using `getBoundingClientRect`, not `element.scrollIntoView` (which scrolls all ancestor scrollers).
- Escape clears the query.

Speaker filter is combined with search: when filtered to a single speaker, only matches in that speaker's bubbles are counted.

---

## Recording controls

Recording lifecycle is split between two placements based on state, to match what the user needs at each moment:

| State | Where controls appear |
|---|---|
| Pre-recording (no recording exists, or last attempt failed) | Transcript pane empty state — hero CTA |
| Recording active (`joining`, `in_meeting`, `recording`, `processing`) | Transcript icon shows the status dot; opening the pane reveals Stop + live duration at the top of the pane |
| Recording completed, transcription processing | Empty state shows "Generating transcript…" with animated dots |
| Transcription completed | Pane displays segments; no controls needed |
| Failed (either recording or transcription) | Empty state shows the failure with a retry affordance |

No separate "Start Recording" button in the header in the steady state. The red pulse dot on the transcript icon is the only persistent recording affordance.

### Empty state variants

Each maps to a specific `TranscriptionStatus` × `MeetingRecordingStatus` combination:

- **No meeting URL on relationship** → *"Set up a Google Meet link in Settings → Integrations to enable recording."*
- **No recording yet** → *"No transcript yet. Record this session to capture a searchable transcript."* + `[Start recording]`
- **Recording live** → *"Recording in progress — transcript will appear here after the meeting ends."* + Stop control + duration
- **Recording done, transcript processing** → *"Generating transcript…"* + animated dots, blocks other actions
- **Failed** → *"Recording failed"* / *"Transcript generation failed"* + `[Try again]`

---

## Backend integration

### Data transport

Fetch-based REST with polling. SSE is the eventual path but out of scope for v1.

### Endpoints (per [PR #254](https://github.com/refactor-group/refactor-platform-rs/pull/254))

| Method | Path | Purpose |
|---|---|---|
| GET | `/coaching_sessions/:id/meeting_recording` | Recording metadata + status |
| POST | `/coaching_sessions/:id/meeting_recording` | Start recording (bot joins) |
| DELETE | `/coaching_sessions/:id/meeting_recording` | Stop recording |
| GET | `/coaching_sessions/:id/transcriptions` | Transcription metadata + status |
| GET | `/coaching_sessions/:id/transcriptions/:tid/transcription_segments` | Ordered text segments |

### Polling strategy

- **Initial fetch** on coaching session page load: `/transcriptions` once, so the status dot can render before the pane is opened.
- **Segments** fetched only when the pane opens and status is `completed`.
- **5s interval** while `meeting_recording.status` is in a live state (`joining`, `waiting_room`, `in_meeting`, `recording`, `processing`).
- **10s interval** while `transcription.status` is `queued` or `processing`.
- **Stop entirely** on terminal states (`completed`, `failed`).
- **Pause on `document.visibilityState === "hidden"`** via `visibilitychange` listener; resume on visibility.
- **30-minute cap** on processing polling. After the cap, show *"Taking longer than expected — refresh to check"* instead of polling indefinitely.

### SWR caching

Completed transcripts are immutable. Configure the segments hook with:

- `revalidateOnFocus: false`
- `dedupingInterval: 60_000`

Without this, SWR's default refocus revalidation refetches the whole segments list every time the user tabs back.

### Timestamps

Backend returns `start_ms: i32`, `end_ms: i32` in milliseconds. Divide by 1000 for display. Format as `mm:ss` (or `hh:mm:ss` if over an hour).

---

## Typing

### Enums for fixed-set status values

TypeScript `enum` with string values matching the backend serialization. Gives symbol references (`TranscriptionStatus.Completed`) instead of magic strings and aligns with the Rust backend's enum style.

```ts
// src/types/transcription.ts
export enum TranscriptionStatus {
  Queued = "queued",
  Processing = "processing",
  Completed = "completed",
  Failed = "failed",
}

// src/types/meeting-recording.ts
export enum MeetingRecordingStatus {
  Pending = "pending",
  Joining = "joining",
  WaitingRoom = "waiting_room",
  InMeeting = "in_meeting",
  Recording = "recording",
  Processing = "processing",
  Completed = "completed",
  Failed = "failed",
}

// src/types/coaching-session-layout.ts
export enum FocusedPane {
  None = "none",
  Notes = "notes",
  Transcript = "transcript",
}

export enum SpeakerFilter {
  All = "all",
  // speakers added dynamically from transcript data
}
```

### Discriminated unions for variant-data modeling

Fetch state and other variant-data scenarios continue to use discriminated unions (per existing nullable-discipline memory):

```ts
type TranscriptFetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; segments: TranscriptSegment[] }
  | { kind: "error"; message: string };
```

---

## Modularity and code style

Every component, hook, and utility is single-purpose and named for what it does. The code reads like a story: the orchestrator at the top calls out to focused collaborators, each of which is short enough to hold in your head.

- Components split as in the composition diagram above.
- Hooks extracted for reusable logic: `useTranscriptSearch`, `useTranscriptPolling`, `useCoachingSessionLayout`, `useTranscriptCopy`, `useSpeakerFilter`.
- Pure utilities: `formatTimestamp(ms)`, `groupBubblesByAdjacency`, `buildSearchMatches`, `escapeRegex`.
- Guideline: if a function exceeds ~30 lines or has more than one level of nested branching, split it.

---

## Error boundary

The transcript pane is wrapped in a dedicated error boundary. A render error in the pane shows *"Couldn't load transcript"* inline and leaves the rest of the coaching session page (Notes, Goals, header) fully functional. Low effort; prevents a pane-specific bug from being a page-level outage.

---

## File layout

### New files

**Types:**
- `src/types/transcription.ts`
- `src/types/meeting-recording.ts`
- `src/types/coaching-session-layout.ts`

**API:**
- `src/lib/api/transcriptions.ts` — two hooks: `useTranscription(sessionId)`, `useTranscriptionSegments(sessionId, transcriptionId)`
- `src/lib/api/meeting-recordings.ts` — `useMeetingRecording`, `startRecording`, `stopRecording`

**Hooks:**
- `src/lib/hooks/use-coaching-session-layout.ts`
- `src/lib/hooks/use-transcript-search.ts`
- `src/lib/hooks/use-transcript-polling.ts`
- `src/lib/hooks/use-transcript-copy.ts`
- `src/lib/hooks/use-speaker-filter.ts`
- `src/lib/hooks/use-transcript-pane-width.ts` — thin selector wrapper around the UI preferences store

**Stores & providers:**
- `src/lib/stores/ui-preferences-state-store.ts` — Zustand store, `persist` middleware backed by `localStorage`
- `src/lib/providers/ui-preferences-state-provider.tsx` — registered at app root alongside other providers

**Utilities:**
- `src/lib/transcript/format-timestamp.ts`
- `src/lib/transcript/group-bubbles.ts`
- `src/lib/transcript/search-matches.ts`

**Components:**
- `src/components/ui/coaching-sessions/transcript-pane.tsx`
- `src/components/ui/coaching-sessions/transcript-pane-desktop.tsx`
- `src/components/ui/coaching-sessions/transcript-pane-mobile.tsx`
- `src/components/ui/coaching-sessions/transcript-pane-header.tsx`
- `src/components/ui/coaching-sessions/transcript-bubble.tsx`
- `src/components/ui/coaching-sessions/transcript-search.tsx`
- `src/components/ui/coaching-sessions/transcript-speaker-filter.tsx`
- `src/components/ui/coaching-sessions/transcript-empty-state.tsx`
- `src/components/ui/coaching-sessions/transcript-status-indicator.tsx` — the dot/glyph on the icon
- `src/components/ui/coaching-sessions/recording-control.tsx` — Start/Stop/status inside the pane
- `src/components/ui/coaching-sessions/transcript-resize-handle.tsx` — drag handle between transcript and Notes; hidden below `lg:`

### Files touched

- `src/app/coaching-sessions/[id]/page.tsx` — replace `notesMaximized: boolean` with `focusedPane: FocusedPane`, extend grid with `minmax(0,1fr)`, add transcript toggle, URL sync
- `src/components/ui/coaching-sessions/coaching-tabs-container.tsx` — accept `focusedPane` and `onToggleMaximize`
- `src/components/ui/coaching-sessions/join-meet-link.tsx` — sibling visual pattern reference for the transcript toggle
- Existing tests touching `notesMaximized` updated to the new enum shape

---

## Phasing

### Phase 0 — Layout refactor (non-breaking, no data)

Ships the structural scaffolding with no transcript data wired.

- Replace `notesMaximized: boolean` with `FocusedPane` enum
- Extend the grid to 3 columns with proper `minmax(0,1fr)` sizing
- Wire `transcriptOpen` state + URL sync (`?transcript=1`, `?focus=`)
- Mount an empty placeholder in the transcript column

**Checkpoint:** page behaves identically to today, internal state refactored.

### Phase 1 — Transcript pane with mock data

Build the pane, search, filter, bubbles, copy, maximize, and empty states against mocked transcription data (hardcoded fixtures matching the real backend shape). Lets the full UI be reviewed and tested without depending on the Recall.ai pipeline.

Also lands the **resizable transcript/notes split** (see below) since resizing is pane UX and belongs with the rest of the pane's interactions.

**Checkpoint:** opening the pane shows a fully functional transcript from mock data. All interactions reviewable end-to-end. Users can drag to resize the transcript-vs-notes boundary, and their width preference survives refreshes and future sessions.

#### Resizable transcript/notes split

When both panes are visible in the 3-column docked view, the coach can drag the vertical boundary between them to rebalance space. Desktop-only; below `lg:` (1024px) the sheet fallback takes over and the handle doesn't apply.

**Constraints and defaults:**
- Default width: 440px (matches Phase 0 initial layout)
- Min transcript width: 280px (prose readability floor)
- Max transcript width: 700px (preserves ~400px minimum for Notes)
- Width value clamped server-side of the store setter, so callers can't write out-of-range values

**Persistence via a new UI preferences store:**

UI preferences get their own Zustand store following the project's established pattern. The key difference from the existing stores: `localStorage` instead of `sessionStorage`, since pane-width preference should survive tab close, logout, and browser restart — it's about how the coach likes their UI, not about who they are in the current session.

New file: `src/lib/stores/ui-preferences-state-store.ts` following the shape of [coaching-relationship-state-store.ts](../../src/lib/stores/coaching-relationship-state-store.ts), with:
- `transcriptPaneWidth: number` state slot
- `setTranscriptPaneWidth(width)` action that clamps to `[MIN, MAX]`
- `resetUIPreferences()` escape hatch
- `createJSONStorage(() => localStorage)` — intentional deviation from sessionStorage used elsewhere
- `persist` middleware gives us cross-tab sync for free

New provider: `src/lib/providers/ui-preferences-state-provider.tsx` wiring the store at the app root next to the other providers.

Leaves room to absorb future UI preferences (default panel section, editor font size, density toggle) without creating a new store each time.

**Drag handle:**
- Use shadcn's `Resizable` primitive (wrapper around `react-resizable-panels`), consistent with the project's UI-kit approach. Install via shadcn CLI if not already present.
- Handle is `role="separator"` with `aria-orientation="vertical"` and `aria-label="Resize transcript"`.
- Keyboard: handle is focusable; ArrowLeft / ArrowRight shift by 24px per press, clamped to min/max. Home/End jump to min/max.
- On drag, update the store's `transcriptPaneWidth`. The grid template reads the store value and applies it to the transcript column: `gridTemplateColumns: ${goals} ${width}px minmax(0,1fr)`.
- Persisting on every pointer-move would thrash localStorage. Strategy: update the store (in-memory) continuously via `requestAnimationFrame`, but `persist` middleware only writes on state change — default debouncing inside Zustand is fine for this cadence. If writes feel heavy, wrap the setter in a small debounce (100ms).

**Interaction with focus mode:**
- Maximizing either pane hides the handle (only one column exists).
- Restoring from maximize returns to the user's stored width, not the default. This is automatic since the store value is the source of truth.

**SSR:**
- `persist` middleware handles the server/client hydration mismatch. The store initializes with the default (440px), then rehydrates from localStorage after mount. A brief flash at the default width is acceptable for v1.

### Phase 2 — Real backend integration (Caleb)

Caleb replaces the mock data source with real API calls from his backend PR, wires recording controls, and validates polling behavior end-to-end. He owns any frontend adjustments needed as the backend contract settles.

**Checkpoint:** feature shipped against real Recall.ai pipeline.

---

## Testing

### Unit

- `format-timestamp.test.ts` — ms → `mm:ss` / `hh:mm:ss` boundary cases
- `group-bubbles.test.ts` — adjacency grouping against original transcript, unaffected by filter
- `search-matches.test.ts` — phrase match, case insensitivity, regex metacharacter escaping, trim
- `use-transcript-search.test.ts` — counter math, prev/next wrap-around, reset on query/filter change
- `use-transcript-polling.test.ts` — interval switching by status, visibility-pause, 30-min cap (fake timers)
- `transcript-bubble.test.tsx` — grouping tails, speaker color mapping, per-bubble copy feedback (mocked clipboard)
- `transcript-speaker-filter.test.tsx` — segmented control semantics, derived labels from data
- `use-coaching-session-layout.test.ts` — focus mode mutual exclusion, URL sync
- `ui-preferences-state-store.test.ts` — default width, clamping at min/max, persistence key and storage backend are correct
- `transcript-resize-handle.test.tsx` — drag updates store, keyboard arrow keys nudge by 24px, Home/End jump to bounds, handle hidden below `lg:`

### E2E

`e2e/transcript-pane.spec.ts` — single MSW-driven test that progresses through the state machine with fake timers:

1. Open session page; no recording exists → empty state with Start CTA, transcript icon has no indicator
2. Start recording → dot pulses red, pane shows "Recording in progress"
3. Stop recording → status moves to processing, dot clears
4. Transcription completes → dot turns green, pane renders segments
5. Search and navigate matches
6. Filter to single speaker
7. Copy a bubble; copy all
8. Maximize transcript; maximize notes (mutual exclusion)
9. URL deep-link round trip
10. Drag the resize handle; width persists across reload

---

## Risks

1. **Backend PR still under review.** Contract fields or status enum values may shift before merge. Implementation that depends on exact field names should be confined to a thin adapter layer so the blast radius of a contract change is small.
2. **`notesMaximized` refactor.** Small state rename, but existing tests and the `handleNotesMaximizedChange` wiring need to follow. Worth its own commit so the diff is reviewable in isolation.
3. **Grid `minmax(0,1fr)` discipline.** The prototype hit a real bug where `1fr` alone stretched the row to content height, breaking internal scroll. Must be preserved verbatim in the real page grid — easy to regress during refactoring.
4. **Polling cost in a backgrounded tab.** If the visibility-pause is forgotten, a tab left open on a processing session polls every 10s indefinitely. Non-trivial backend cost over a long workday.

---

## Out of scope, confirmed

- Timestamp-to-video seek (no playback in v1)
- Cross-session or cross-user transcript search
- AND/OR/regex search operators
- Virtualization
- Persistent speaker label mapping (Caleb may add in backend; v1 shows raw labels)
- Cmd+F intercept inside the pane (overriding browser find is usually worse than helpful)

## v2 polish backlog

- Tab title badge during active recording (e.g. `● Recording · Jim / Bob`)
- SSE replacement for polling
- Download transcript as `.txt`
- "Add selection to notes / as action" — its own design problem worth separate treatment
