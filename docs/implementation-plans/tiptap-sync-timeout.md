# Implementation: TipTap Sync Timeout — Fix Stuck Coaching Notes Loading

**Date**: 2026-02-09
**Branch**: `improve-coaching-notes-loading-timeout`

## Problem

When navigating to a coaching session page in production, the coaching notes editor sometimes gets stuck showing a loading spinner (skeleton toolbar + "Loading coaching notes...") indefinitely. The root cause: `EditorCacheProvider.initializeProvider()` waits for the TipTap Cloud WebSocket `"synced"` event before creating editor extensions and mounting the editor. If `"synced"` never fires (transient TipTap Cloud issue, slow network), the editor stays in loading state forever with no timeout or fallback. A manual browser refresh fixes it (the retry succeeds).

This only occurs in production because TipTap Cloud latency/reliability differs from local dev.

## Solution

Add a 10-second sync timeout to `initializeProvider()`. The `TiptapCollabProvider` is created immediately (starting the WebSocket connection and sync), but extensions are created and the editor is mounted only when **either**:

1. The `"synced"` event fires (normal path, typically < 1s), or
2. The 10-second timeout expires (fallback to offline editing)

Both paths call the same `enableEditing()` helper, guarded by an `extensionsCreated` flag to prevent duplicate creation. In the timeout path, the provider keeps retrying sync in the background; if sync eventually succeeds, Y.js CRDT merges any local edits with server content seamlessly.

## State Transitions

| Phase | `isLoading` | `extensions` | `isReady` | `provider` | UI |
|---|---|---|---|---|---|
| Token fetch | `true` | `[]` | `false` | `null` | Skeleton + spinner |
| Provider created, syncing | `true` | `[]` | `false` | exists | Skeleton + spinner |
| Sync completes | `false` | populated | `true` | exists | Editor (editable) + "Connected" |
| Timeout (no sync) | `false` | populated | `true` | exists | Editor (editable) + "Offline" |
| Late sync after timeout | `false` | populated | `true` | exists | Content merges via CRDT + "Connected" |
| Token error | `false` | `[]` | `false` | `null` | Error state with retry |

## Files Modified

### 1. `src/components/ui/coaching-sessions/editor-cache-context.tsx` (primary)

- Added `SYNC_TIMEOUT_MS = 10_000` constant
- Added `syncTimeoutRef` ref alongside existing refs
- Restructured `initializeProvider()`:
  - Provider created immediately (unchanged)
  - Awareness set (unchanged)
  - `enableEditing()` helper creates extensions and updates cache with `isReady: true`
  - `extensionsCreated` flag prevents duplicate extension creation
  - `"synced"` handler: clears timeout, calls `enableEditing()`
  - Timeout handler: warns to console, calls `enableEditing()`
- Added timeout cleanup (`clearTimeout`) in all 6 cleanup paths:
  - `ActionKind.Cleanup` case in lifecycle effect
  - Lifecycle effect cleanup return function
  - Unmount cleanup effect
  - Logout cleanup callback
  - `resetCache` function
  - `catch` block in `initializeProvider`

### 2. `src/components/ui/tiptap-ui/link-popover/link-button.tsx`

- Added `!editor.isEditable` guard to `LinkButton` for consistency with all other toolbar buttons (MarkButton, HeadingDropdownMenu, UndoRedoButton, etc.)

### 3. `__tests__/components/ui/coaching-sessions/editor-cache-context.test.tsx`

- Rewrote mock provider: changed from auto-triggering `"synced"` after 10ms to controllable `_triggerEvent` helper
- Tests manually trigger synced via `mockProvider._triggerEvent('synced')`
- Added `has-extensions` and `is-loading` test data attributes to TestConsumer
- New tests: extensions created on sync, sync timeout enables offline editing, timeout cleared on normal sync, late sync after timeout is idempotent
- Sync timeout tests use `vi.useFakeTimers({ shouldAdvanceTime: true })`

### 4. `__tests__/components/ui/coaching-sessions/coaching-notes/connection-status.test.tsx`

- Removed test for intermediate "Connecting..." state (no longer exists in the final approach)

### Files NOT Modified

- `src/components/ui/coaching-sessions/coaching-notes.tsx` — existing loading gate `if (isLoading || extensions.length === 0)` works correctly
- `src/components/ui/coaching-sessions/coaching-notes/extensions.tsx` — no changes needed
- `src/components/ui/coaching-sessions/coaching-notes/connection-status.tsx` — no changes needed

## Approaches That Did Not Work

### Approach 1: Mount editor before sync with `isReady: false`

**Idea**: Create extensions immediately after provider construction (before `"synced"`), mount the editor in read-only mode (`editable: () => isReady` with `isReady = false`), then flip `isReady = true` on sync/timeout.

**Why it failed**: TipTap's `EditorProvider` captures `editorProps.editable` at editor creation time only — it does NOT re-apply the function on React re-renders. The closure over `isReady = false` was permanently baked in, so the editor stayed read-only even after `isReady` became `true`. All toolbar buttons check `editor.isEditable` and return `null` when false, resulting in only the link button being visible (it was the only one missing the `isEditable` check).

### Approach 2: `EditableSync` component calling `editor.setEditable()`

**Idea**: Add a child component inside `EditorProvider` that uses `useCurrentEditor()` and calls `editor.setEditable(isReady)` in a `useEffect` when `isReady` changes.

**Why it failed**: `editor.setEditable()` dispatches a TipTap transaction. However, `shouldRerenderOnTransaction={false}` on the `EditorProvider` (needed for performance) prevents React re-renders from transactions. So: the initial render happens with `editor.isEditable = false` -> all toolbar buttons return `null` -> the `useEffect` runs `setEditable(true)` -> no React re-render triggered -> toolbar stays permanently empty with no buttons and no `ConnectionStatus` badge.

## Testing Guide

### Automated Tests

```bash
# Run editor cache context tests (includes sync timeout tests)
npx vitest run __tests__/components/ui/coaching-sessions/editor-cache-context.test.tsx

# Run connection status tests
npx vitest run __tests__/components/ui/coaching-sessions/coaching-notes/connection-status.test.tsx

# Run all tests
npx vitest run
```

### Manual Testing — Normal Flow

1. Navigate to a coaching session with coaching notes
2. Verify the editor loads with toolbar buttons and "Connected" badge
3. Type in the editor — content should save and sync
4. Open the same session in a second browser tab — edits should appear in real-time

### Manual Testing — Timeout Flow (simulating sync failure)

To test the timeout path, temporarily break the TipTap connection and shorten the timeout:

1. In `.env.local`, change `NEXT_PUBLIC_TIPTAP_APP_ID` to a bogus value (e.g. `"bogus-test-id"`)
2. In `src/components/ui/coaching-sessions/editor-cache-context.tsx`, change `SYNC_TIMEOUT_MS` from `10_000` to `3_000`
3. Restart the dev server (`npm run dev`)
4. Navigate to a coaching session
5. Loading skeleton shows for ~3 seconds, then editor mounts with "Offline" badge and full toolbar
6. Check Console for: `TipTap sync did not complete within 3000ms — enabling offline editing`
7. Revert both changes and restart the dev server

### Manual Testing — Reconnection

1. Load a coaching session normally (editor shows "Connected")
2. Disable network (DevTools -> Network -> Offline)
3. Badge should change to "Offline"
4. Type some content while offline
5. Re-enable network
6. Badge should change to "Connected", offline edits preserved and synced

## Risks & Mitigations

1. **User types before sync, content merges** — In the timeout path, user types after seeing "Offline" badge. Y.js CRDT handles merge correctly when sync eventually completes.

2. **Empty editor during sync** — Expected. Loading skeleton shows until sync/timeout. Content appears when editor mounts.

3. **Timeout leak on rapid session changes** — Every cleanup path clears `syncTimeoutRef`. The `enableEditing()` call checks `extensionsCreated` for idempotency.
