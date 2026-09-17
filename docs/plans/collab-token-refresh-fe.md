# Plan: fresh collaboration tokens and honest connection teardown

Tracks FE issue #461. Method: overseer + per-phase implementer handoffs.

## Problem

- The collab JWT expires 24h after issue. SWR caches it per session for the tab's
  lifetime, so an in-app revisit builds the TipTap provider with a stale token.
- A rejected token leaves the provider disconnected forever. Nothing handles
  `authenticationFailed`, so after the 10s sync timeout the editor becomes editable
  against a local-only Y.Doc and edits are lost on reload.
- Side issue: switching sessions in-app only `disconnect()`s the old provider. With
  hocuspocus' default `preserveConnection: true` the socket stays open, so stale
  presence lingers.

## Design

- The provider fetches its own token lazily on every connect (`token: async fn`),
  so reconnects and revisits never reuse a cached JWT. The SWR-cached JWT only
  supplies the document name (`sub`).
- `authenticationFailed` is terminal for that provider: tear it down, show the
  notes error state, and let "Try Again" refetch the token and re-initialize.
  The sync-timeout offline fallback never runs after an auth failure.
- One `teardownProvider` helper owns every provider shutdown (session change,
  unmount, logout, reset, auth failure): broadcast disconnected presence when the
  role is known, `destroy()` the provider, `destroy()` its websocket provider.
  Provider is constructed with `preserveConnection: false`.

## Phases

| # | Scope | Status |
|---|-------|--------|
| 1 | Lazy token fetch + `authenticationFailed` handling + working retry | pending |
| 2 | Unified teardown that closes the socket on every shutdown path | pending |

## Acceptance (frozen; overseer verifies each has teeth)

Phase 1
- Provider is constructed with `token` as a function; invoking it calls
  `fetchCollaborationToken(sessionId)` and resolves to that response's token, not
  the SWR-cached one.
- After `authenticationFailed`: `error` set, `isReady` false, `extensions` empty,
  `collaborationProvider` null, provider destroyed; advancing 10s does not enable
  editing.
- `resetCache()` after an auth failure refreshes the token and constructs a new
  provider.

Phase 2
- Session change, unmount, logout, and reset each call `destroy()` on the provider
  and on `provider.configuration.websocketProvider`.
- Constructor config includes `preserveConnection: false`.

## Follow-ups / known gaps

- Consider a shorter server-side JWT lifetime once the FE always fetches fresh.
- Overseer to re-verify against the running backend and Tiptap Cloud with an
  expired token before merge.
