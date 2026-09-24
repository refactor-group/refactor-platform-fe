# Images in Coaching Notes — Implementation Plan (FE #144)

Visual version: `.lavish/images-in-coaching-notes-plan.html`

## Context

Issue [#144](https://github.com/refactor-group/refactor-platform-fe/issues/144) asks for images in
Coaching Notes so coaching sessions can stop depending on a parallel Google Doc. The editor half is
small. The platform has **no object storage and no file upload of any kind** in either repo, so this
issue really means "stand up the first binary asset pipeline, and make the notes editor its first
consumer." The pipeline is built generically (a trait, a config block, a key convention) so org
logos and profile pictures — which the issue also flags — reuse it later.

## The load-bearing fact

Note content never touches the REST backend. It is a Yjs CRDT streamed over a websocket to
`docs-collab-server` and persisted as one opaque `BYTEA` blob per session in
`refactor_platform.collab_documents`. Three consequences drive every decision below:

1. **No base64.** A data URI lands inside the CRDT, is re-broadcast on every join and re-persisted
   on every debounce. Ten screenshots would be tens of MB re-downloaded per session open — and the
   editor is gated on that sync (`SYNC_TIMEOUT_MS = 10_000`).
2. **Anything written into an image node is permanent and un-greppable.** So it can contain neither
   an expiring signature nor a hostname we might change. Store an **image id**, resolve the URL at
   render time.
3. **No export path to break.** Note content is never rendered outside the editor.

## Decisions (settled with Jim, 2026-09-22)

| | |
|---|---|
| **Storage** | Local filesystem in local dev; **DO Spaces** in PR previews and production. One `object_store` trait (crate `object_store` v0.14.2 covers `LocalFileSystem` + `AmazonS3`), selected by env var. Local dev needs no Spaces credentials. |
| **Serving** | Stable `GET /coaching_session_images/:image_id`, cookie-authorized, then **302 to a presigned Spaces GET** (900 s). The local backend can't presign, so a **streaming path** ships alongside it. |
| **Upload transport** | Browser → backend `multipart`, so the server can sniff magic bytes and enforce the cap for real. |
| **Insert timing** | **Upload first, insert the node on success.** No placeholder node in the shared document. |
| **Pasted remote images** | **Strip** foreign `<img>` with one toast. Sideloading deferred (SSRF review). |
| **Limits** | 10 MB; client-side downscale to a max edge; reject SVG uploads and strip inline `<svg>` from pasted HTML. |
| **v1 scope** | Toolbar button, clipboard paste, drag & drop with a drop indicator, click-to-delete, click-to-view-full-size, alt text. **No in-editor resize** — `max-width: 100%`, but the `width` attr goes in the schema now. |

### Why upload-first, not a placeholder node

TipTap's own `ImageUploadNode` inserts a placeholder node and swaps it. Their simple-editor template
is **single-user** and their docs say nothing about that node inside a Yjs document. In ours the
placeholder replicates to the coachee, and a tab that dies mid-upload strands it permanently in
shared state. Also: `Collaboration` is configured with `yUndoOptions: { trackedOrigins: [null] }`, so
a replace dispatched from a network callback can end up *untracked* — a mutation Cmd-Z can't
reverse. Upload-first makes the insert an ordinary local transaction, and a failed upload leaves the
document byte-identical.

Progress renders as a **local ProseMirror decoration**, which is never serialized into Yjs.

### Why the cookie approach works (an invariant, not an accident)

The session cookie is `SameSite=Lax` and host-only (`web/src/lib.rs:142-144`). `<img>` is a
subresource, so a genuinely cross-site load would arrive unauthenticated. It doesn't: production
serves both apps from one origin (`nginx/conf.d/refactor-platform.conf` routes `/api/` → backend,
`/` → Next.js on `myrefactor.com`); PR previews use the same path routing; locally `:3000` and
`:4000` are the same *site* (SameSite ignores ports).

**Moving the API to a different registrable domain breaks every note image with no client-side fix.**
Put this in a comment on the route.

## Backend — refactor-platform-rs

Mirror `coaching_session_topics`, the current-idiom sub-resource.

**Endpoints**

```
POST /coaching_sessions/{coaching_session_id}/images
  CompareApiVersion, CoachingSessionAccess, AuthenticatedUser, Multipart
  multipart/form-data, part "file"
  201 { status_code, data: { id, coaching_session_id, mime_type, byte_size, width, height, created_at } }
  400 no file · 403/404 no access · 413 oversize · 415 unsupported/SVG · 503 storage unconfigured

GET /coaching_session_images/{image_id}
  CoachingSessionNoteImageAccess only — deliberately NO CompareApiVersion
  302 → presigned GET (or stream the bytes when the backend can't sign)
  Cache-Control: private, max-age=600   (must be < presign TTL)
  Vary: Cookie
```

`<img>` cannot send the `X-Version` header, which is why `CompareApiVersion` is omitted. Comment it
or someone will "fix" it back.

**Files**

- `domain/src/gateway/object_storage.rs` — `ObjectStore` trait (`put`, `presigned_get`, `delete`)
  plus local and Spaces impls. Tested with `mockito`, the house gateway pattern.
- `entity/`, `entity_api/`, `domain/` triple for `coaching_session_note_images`, registered in each
  crate's `lib.rs`. Domain does PUT-then-insert.
- `migration/src/m<date>_create_coaching_session_note_images.rs` — raw SQL via `execute_unprepared`,
  schema-qualified, FK to `coaching_sessions` (`ON DELETE CASCADE`) and `users`, index on
  `coaching_session_id`, and the mandatory `ALTER TABLE … OWNER TO refactor`.
- `web/src/extractors/coaching_session_note_image_access.rs` — mirrors
  `coaching_session_topic_access.rs`: image → session → relationship → `grants_access_to(&user)`.
- `web/src/controller/coaching_session/note_image_controller.rs` — modelled on `topic_controller.rs`.
- `web/src/router.rs` — route fn + `.merge()` + utoipa `paths(...)`/`schemas(...)`, and
  `DefaultBodyLimit::max(...)` **on the POST route only**. `router_tests.rs` fails until registered.
- `service/src/config.rs` — `object_store_backend`, `spaces_{endpoint,region,bucket,access_key_id,secret_access_key}`,
  `object_store_local_path`, `note_image_max_bytes`, `note_image_presign_ttl_seconds`. Secrets behind
  accessors; non-secrets into `log_non_secret_config()`.
- `src/main.rs` + `web/src/lib.rs` — build `Option<Arc<dyn ObjectStore>>` once at boot and hang it on
  `web::AppState`, exactly the `recording_bot_provider` precedent. `None` → 503, so the app still boots.
- `web/Cargo.toml` — `axum` gains `multipart`.

Storage key: `coaching-sessions/{session_id}/notes/{image_id}.{ext}`.

**Validation** — all server-side, on the received bytes. Declared `Content-Type` is advisory only;
sniff magic bytes (`infer`). Allow png/jpeg/webp/gif, reject SVG (executable markup → stored XSS).
Cap at 10 MB, enforced by both `DefaultBodyLimit` and an explicit count. Read dimensions only
(`imagesize`, not the full `image` crate) and reject absurd pixel counts before any decode. Animated
GIFs pass through un-re-encoded.

## Frontend — refactor-platform-fe

This repo is already a partial adoption of TipTap's **simple-editor template** (`tiptap-ui/`,
`tiptap-ui-primitive/`, `tiptap-icons/`, `src/lib/tiptap-utils.ts`). Missing is the template's
`tiptap-node/` folder — exactly where `image-upload-node` and `image-node` live. **Install upstream's
`image-upload-button` and `image-node` via the TipTap CLI rather than hand-rolling them**, keep their
`upload(file, onProgress, abortSignal) => Promise` signature verbatim so updates stay mergeable, and
diverge only on progress rendering (local decoration, not a document node).

- `npm i @tiptap/extension-image @tiptap/extension-file-handler` (both MIT). Pin to the
  **installed** `@tiptap/core` version, not latest: TipTap pins peers exactly, so the newest
  publish demands bumping the whole TipTap set. Currently 3.29.2.
- `src/types/coaching-session-image.ts` — wire type + parser. Absent dimensions use `Option<T>` from
  `src/types/option.ts`, never `| null`.
- `src/lib/api/coaching-session-images.ts` — `upload()` returning `Result<…, UploadFailure>`, and
  `coachingNoteImageUrl(imageId)` from `siteConfig.env.backendServiceURL`. Mirror
  `transcriptions.ts:downloadText()` (sessionGuard + neverthrow + `readErrorSlug`). Needs its own
  longer timeout — the shared `sessionGuard` instance is 15 s. Let axios set the multipart boundary.
- `src/lib/utils/downscale-image.ts` — pure and unit-testable; canvas downscale capping the long
  edge, GIFs passed through.
- `…/coaching-notes/note-image-extension.tsx` — `Image.extend({ name: "coachingNoteImage" })` with
  `imageId` / `alt` / `width` attrs; `FileHandler` with `onPaste`/`onDrop`; a paste sanitizer
  stripping foreign `<img>`/`<svg>`.
- `…/coaching-notes/note-image-view.tsx` — the React NodeView: resolves `src`, loading/error states,
  hover-revealed delete, lightbox via `src/components/ui/dialog.tsx`, and a debounced alt-text
  popover following `link-popover`.
- `…/coaching-notes/extensions.tsx` — new `addImageExtensions(...)` group. **Signature change:**
  `Extensions(doc, provider, user)` also needs the coaching session id and an upload fn;
  `editor-cache-context.tsx` already has `sessionId` in scope. Also configure the already-registered
  but bare `Dropcursor` (`extensions.tsx:181`) with a color and width, and style it — that *is* the
  Asana-style drop indicator, and `FileHandler`'s `onDrop(editor, files, pos)` gives the matching
  insert position.
- `…/coaching-notes/simple-toolbar.tsx` — add the upload button to the third `ToolbarGroup`.
- `src/styles/simple-editor.scss` — image sizing, selected-node ring, drop-cursor styling.

**Two things that will surface in review**

- **`renderMarkdown` is not optional.** `TableMarkdownPasteHandler` calls `editor.markdown` on
  *every paste*. Without it, pasting into a note that already contains an image can throw.
  `markdown-table-extension.tsx:237` shows the `addOptions()` shape. Do **not** rebuild a node from
  arbitrary pasted markdown — that would let anyone reference any image id.
- **Do not define `leafText`.** `SelectionBubbleMenu` seeds Actions and Topics from
  `doc.textBetween(from, to, " ")` and bails on empty text, so an image-only selection correctly
  suppresses the menu. Pin that with a test.

## Sequencing

0. **Provision the Space** (~1h, DO console) — blocks end-to-end verification.
1. **Backend** (~2d) — everything above, verifiable with `curl` before any frontend exists.
2. **Frontend** (~3d) — against the running backend from phase 1.
3. **Infra/env** (~0.5d) — new vars into `.env*`, `docker-compose{,.pr-preview,.dev-staging}.yaml`,
   `docs/setup.md`, and the PR-preview GitHub secrets. Mind the `secrets: inherit` pitfall in
   CLAUDE.md. **Verify `client_max_body_size` in the preview nginx `http` block** — production has
   50 m at `nginx/nginx.conf:77`; `nginx-preview/pr-previews.conf` sets nothing obvious.

Total ~5–7 days across both repos.

## Verification

- **Backend unit:** sniffing/allowlist/size/dimension rules, including an SVG rejection and a
  PNG-with-lying-Content-Type. Gateway against `mockito`. `entity_api` with `MockDatabase`.
  Run: `cargo test -p entity_api -p domain -p web --features "domain/mock,web/mock"` — never
  `--workspace --features mock`.
- **Backend integration** (full Axum app + real login round-trip): upload happy path; upload and GET
  by a non-participant → 403/404; GET returns 302 with `Location` and a `Cache-Control` max-age
  **strictly less than** the presign TTL (assert the inequality, not the literals); oversize → 413;
  `router_tests.rs` registration.
- **Frontend unit:** validation and downscale helpers; the API module against mocked axios.
- **Frontend integration (real TipTap)**, mirroring
  `__tests__/…/coaching-notes-markdown-extensions.test.tsx`: an image node renders;
  `editor.markdown` doesn't throw and emits `![...](...)`; `doc.textBetween` over an image-only
  selection is empty and `shouldShowSelectionMenu` returns false; a failed upload leaves
  `editor.getJSON()` byte-identical; upload still works while `isSynced === false`.
- **Playwright:** the editor is unreachable under mocked routes (needs a live collab JWT + websocket
  — see `__tests__/e2e/add-from-notes-selection.spec.ts`). Cover the button's presence and disabled
  states only. **Do not** attempt an e2e upload.
- **Manual, against a running backend** (required by repo convention before commit): paste a
  screenshot; drag a file from Finder and confirm the drop indicator appears at the right place —
  `Dropcursor` is known to work for ProseMirror node drags but **is unverified for external file
  drags**; if it doesn't fire, fall back to a small `dragover` plugin. Then delete, undo, lightbox,
  alt text, and a second browser confirming the image appears for the other participant.

## Known gaps, accepted

- **Orphaned objects.** Deleting an image from a note happens inside opaque CRDT state, so the
  backend never learns of it. v1 deletes nothing. Any future reaper **must** keep undo working —
  give it a grace period, and note that the only correct reference check is loading the Y.Doc and
  walking it for `imageId` attrs, which is Node-side work.
- **Pre-existing, worth its own issue:** `collab_documents` has no foreign key to
  `coaching_sessions`, so deleting a session already orphans its note blob.
