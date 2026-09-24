# Test Plan: Manually Testing Images in Coaching Notes (Frontend)

Verify a coach can add images to a coaching note by toolbar, paste and drag-and-drop; that
they render, delete, undo, open full size and take alt text; that failures never corrupt the
shared document; and that a second participant sees the same thing.

Backend counterpart: `refactor-platform-rs/docs/test-plans/coaching_session_images_manual_testing.md`.
Implementation plan: `docs/plans/images-in-coaching-notes-fe.md`.

> [!IMPORTANT]
> Playwright **cannot** reach this editor: it needs a live collaboration JWT and a real
> websocket, which the mocked-route harness does not provide (see
> `__tests__/e2e/add-from-notes-selection.spec.ts`). The Vitest suite builds a real TipTap
> editor but has no browser clipboard, no file drag, no second participant and no real
> network. **Sections 3, 4 and 5 are the only proof this feature works at all.** Section 4
> in particular has no automated equivalent anywhere.

> [!NOTE]
> Requires frontend phase F3 (toolbar button) and backend phases B3/B4. Before F3, every case
> below is reachable via paste and drag-and-drop; only Case 1 needs the button.

## 1. Prerequisites

- Backend on `144-coaching-note-images` running on `:4000` with object storage configured
  (`OBJECT_STORE_BACKEND=local` is fine and needs no credentials), migrations applied.
- Frontend on `144-images-in-coaching-notes`, `npm run dev` on `:3000`.
- `docs-collab-server` running on `:1234`. Without it the editor drops into offline mode after ten
  seconds: Section 4 becomes untestable entirely, and Case 21 is the only case still worth running.
- A coaching session you are a participant in, opened at
  `/coaching-sessions/<id>` on the **Notes** tab.
- **Two browsers** (or one plus an incognito window) signed in as the coach and the coachee
  respectively, both on the same session. Section 4 needs this.

### 1.1 Fixture files

```sh
cd /tmp
# Any real photo or screenshot works. A large one is useful: it exercises downscaling.
# Take a screenshot to the clipboard with Cmd-Ctrl-Shift-4 when a case calls for a paste.
cp <some large photo> /tmp/big-photo.jpg     # ideally > 3 MB, > 2000px on the long edge
cat > /tmp/evil.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>
SVG
head -c 11534336 /dev/zero > /tmp/too-big.png
```

## 2. Adding an image

### Case 1: toolbar button

Click the image button in the Notes toolbar, pick a PNG.

**Pass:** the image appears at the cursor with **no toast at all** on a fast upload. A toast
reading "Adding image" only appears if the upload is slow enough to need it, and it disappears
on its own when the image lands. Nothing ever announces success. The toolbar button sits in the
same group as the link button and looks like its neighbours (ghost, same icon size).

### Case 2: paste a screenshot

Take a screenshot to the clipboard, click into the note, press Cmd-V.

**Pass:** same as Case 1 — on localhost this should be completely silent, the image simply
appearing. **This is the case the feature exists for** — it is how a coach
actually uses it mid-session.

### Case 3: drag and drop, with the drop indicator

Drag an image file from Finder over the note. **Before releasing**, watch the caret area.

**Pass:** a visible horizontal line marks where the image will land, and it tracks the
pointer between blocks. On release the image is inserted **at the line's position, not at the
caret**, with no success toast. Drop it between two existing paragraphs to make this
unambiguous.

> The line comes from the `Dropcursor` extension, which does fire for external file drags. If
> no line appears, treat it as a regression rather than a known limitation.

### Case 4: a large photo is downscaled before upload

With DevTools Network open, drop `/tmp/big-photo.jpg` (> 3 MB, > 2000 px).

**Pass:** the POST request body is materially smaller than the source file, and the response
`width`/`height` show the long edge capped near 2000 px. The image still looks right.

### Case 5: an animated GIF is not flattened

Drop an animated GIF.

**Pass:** it still animates in the note. Downscaling deliberately passes GIFs through
untouched, because canvas re-encoding would reduce it to frame one.

## 3. Rendering, editing, removing

### Case 6: the document stores an id, not a URL

With the image in the note, open DevTools and inspect the rendered `<img>`.

**Pass:** `src` points at `/coaching_session_images/<id>` on the backend. The URL is computed at
render time; nothing environment-specific is written into the document. Reload the page and
confirm the image still renders.

> The rendered `<img>` does **not** carry `data-image-id`. It is drawn by a React node view,
> which reads the id straight from the node; the attribute appears only in serialized HTML,
> such as a copy to the clipboard. Its absence here is expected.

### Case 7: delete, then undo

Hover the image, click the remove control in its corner, then press Cmd-Z.

**Pass:** the controls (full size and remove) only appear on hover; on a touch device they stay
visible. The image
disappears, and **undo brings back a working image, not a broken one** — deleting the node
never deletes the stored bytes. This is load-bearing: any future storage cleanup must not
break it.

### Case 8: full size

Hover the image and click the full-size control in its corner, beside remove.

**Pass:** a dialog opens showing it at natural size, with a close button that stays legible over
a dark image. Escape closes it. Clicking the image itself does **not** open the dialog (it
selects the image; see Case 9), and neither does clicking the remove control.

### Case 9: alt text

Click the image to select it. A description field appears beneath it; type into it, then
inspect the rendered `<img>`.

**Pass:** the field appears on the click with no dialog in the way, and `alt` reflects what you
typed. Watch the collaboration traffic while typing: writes are debounced, so a burst of
keystrokes does not produce one update per character. Click elsewhere in the note immediately
after the last keystroke: the description is kept, not lost to the debounce. Drag across the
text in the field to select it: the text selects and the image does not move. Reload and it is
still there. Leaving it empty renders `alt=""`, which is correct for a decorative image.

### Case 10: text extraction ignores images

Click the image so it is selected on its own.

**Pass:** the selection bubble menu (Add as Action / Agreement / Goal) does **not** appear. Select text
*and* the image together: the menu appears and the prefilled body contains only the prose.

### Case 11: move an image already in the note

Put an image in a note with paragraphs above and below it. Press on the image and drag it to a
different position between paragraphs.

**Pass:**

- A drop line appears and tracks the pointer between blocks, and the image being moved dims in
  place. **Nothing follows the cursor** — no translucent copy of the image, in any browser.
- On release the image lands **at the line**, and the line disappears.
- Reload the page: the image is still in its new position, so the move reached the shared
  document and not just the local view.
- The row for that image still has `deleted_at` `NULL`. A move is one transaction, so it must
  not be mistaken for a removal.
- A press and release without moving is a click: it selects the image and moves nothing.
- Click the image to select it, **then** drag it upward. It moves the same way with no ghost,
  and clicking it at its new position still selects it and shows the description field.

> Images are moved with pointer events, not HTML5 drag-and-drop, so the browser never builds a
> drag preview in the first place. A ghost image appearing at all is a regression. Check in
> **Chrome and Safari**.
>
> Moving is for a mouse or pen. On a touch device, dragging a finger over an image scrolls the
> note and leaves the image where it is; that is intended, since taking the gesture over would
> make a note full of images impossible to scroll on a phone.
>
> Drops resolve between top-level blocks. Dragging over a list or a table places the image
> before or after that whole block, not inside it; that is intended.

### Case 23: deleting marks the row, undo clears it

Add an image and note its id from the rendered `src`. Delete it with the hover control, then
check the backend database:

```sql
SELECT id, deleted_at FROM refactor_platform.coaching_session_images WHERE id = '<image id>';
```

**Pass:** `deleted_at` holds a timestamp and the row still exists. Press Cmd-Z: the image
renders again, and the same query shows `deleted_at` back to `NULL`. Undo needs no re-upload,
because the bytes were never destroyed.

### Case 24: backspace signals the same way

Repeat Case 23, but remove the image by putting the cursor at the start of the paragraph
directly after it and pressing Backspace once. The image is removed on that first press.

**Pass:** identical to Case 23. This is the path most likely to regress, because removal is
detected from the document transaction rather than from the hover control.

### Case 25: reload after a delete

Delete an image, then reload the page.

**Pass:** the image is gone from the note, and the row is still present in SQL with
`deleted_at` set, so it remains recoverable until the grace period elapses. **No automated
test covers this** — it is the whole point of deferring destruction.

## 4. Two participants (no automated equivalent)

Both browsers on the same session, Notes tab.

### Case 12: an image replicates

Coach adds an image.

**Pass:** it appears in the coachee's note within a second or two, rendering correctly — the
coachee fetches it with their own cookie, proving authorization is per-viewer.

### Case 13: no placeholder ever replicates

Throttle the coach's network to "Slow 3G" in DevTools and add a large image. Watch the
**coachee's** screen for the entire upload.

**Pass:** the coachee sees **nothing at all** until the image is fully uploaded, then the
finished image appears. They must never see a spinner, a grey box, or any placeholder for a
file they did not choose. This is the single most important case in this document: it is the
reason uploads complete before anything is written to the shared document.

### Case 14: a dead tab strands nothing

Start a large upload as the coach, then **close the coach's tab mid-upload**.

**Pass:** the coachee's note is unchanged and contains no leftover node. Reopen the session as
the coach: still clean.

### Case 26: a removal is signalled once, not twice

With both browsers on the session, the coach deletes an image. Watch the coachee's DevTools
Network tab, and check the row afterwards.

**Pass:** exactly one `DELETE /coaching_session_images/<id>` is sent, from the coach's browser.
The coachee's client, which sees the same node disappear over the websocket, sends nothing.
The row has a single `deleted_at` timestamp.

## 5. Failures and edge cases

### Case 15: file too large

The cap applies to what would actually be sent, not to what you picked, so this needs two
files. Both are refused before the network; they differ in where the refusal happens.

**15a, past the decode ceiling.** Drop a PNG over 40 MB (four times the cap). Generate one
with `magick -size 4000x4000 xc: +noise Random /tmp/way-too-big.png`.

**Pass:** an error toast, **the document is unchanged**, and no POST is sent. The file is
refused without being decoded.

**15b, over the cap but downscalable.** Drop a 2400x2400 PNG of around 12 MB
(`magick -size 2400x2400 xc: +noise Random /tmp/big-photo.png`).

**Pass:** it **uploads successfully**, because downscaling brings it under the cap. This is
the phone-photo case, and refusing it would be the bug. Check the row: `byte_size` is well
under 10 MB and `mime_type` is `image/webp`.

**15c, incompressible and over the cap.** A file that downscaling cannot rescue still has to
be refused. Hard to hit by hand with real photos; the unit tests cover it directly.

In every rejection the message must not quote a size limit or any backend policy number.

### Case 16: SVG is refused

Drop `/tmp/evil.svg`.

**Pass:** an error toast, document unchanged, no upload. No alert dialog appears — if you see
`alert(1)`, stop and treat it as a security incident.

### Case 17: the upload fails server-side

Stop the backend, then paste an image.

**Pass:** an error toast, and **the note is byte-identical afterwards**. Reload and confirm
nothing was persisted. Restart the backend and retry the same paste: it succeeds.

### Case 18: storage unconfigured

Restart the backend with `OBJECT_STORE_BACKEND=spaces` and no credentials, then paste.

**Pass:** an error toast telling the user images are unavailable right now, in plain language.
The rest of the note stays fully editable — typing, formatting and topics all still work.

### Case 19: a broken image

Delete the stored object on the backend (see the backend plan, Case 14), tick **Disable cache**
in DevTools' Network tab, and reload the note. Without that the browser serves the image from
its cache and the placeholder never appears.

**Pass:** a quiet muted "this image isn't available" block **occupying the same box the image
did**. **No broken image icon, and no layout jump** — put a line of text directly below the
image first, note where it sits, and confirm it has not moved after the reload.

Images uploaded before this behaviour existed carry no recorded dimensions, so their
placeholder falls back to a text-sized block and the text below it does move. Only a
freshly uploaded image tests the reserved box.

### Case 20: pasting from Google Docs

Copy a passage containing images out of a Google Doc and paste it into the note.

**Pass:** the text arrives. The remote images are **stripped**, and one toast explains that
images pasted from another app were not included and to paste the image itself. Exactly one
toast, not one per image. Inspect the note: no `<img>` pointing at
`lh3.googleusercontent.com` survived, and **no blank paragraphs are left where the images
were** — the paragraphs of text should be adjacent, exactly as in the source document.

> Why stripping is correct: those URLs are short-lived and account-scoped. Keeping them makes
> a note that looks fine to the author today and is already broken for the coachee.

### Case 21: uploading while the collaboration socket is down

Stop `docs-collab-server`, reload the session, wait ten seconds for offline mode, then paste
an image.

**Pass:** the upload **succeeds** and the image appears locally. Uploads go over REST, not the
websocket, so they are no more at risk than the characters you type in the same state. The
connection indicator shows the disconnected state throughout.

### Case 27: the removal signal fails

Delete an image with the backend stopped.

**Pass:** the image disappears from the note as normal, **no error toast appears**, and the
rest of the editor keeps working. The signal is best-effort: a lost one leaves a row behind,
which is invisible to the user and far better than interrupting them.

### Case 22: another session's image id

As a participant of session A, edit the URL to fetch an image id belonging to session B that
you are not a participant of.

**Pass:** the image does not render. Covered more precisely by the backend plan's Case 11;
repeated here because it is the one thing a user could stumble into by sharing a link.

## 6. Cleanup

```sh
rm -f /tmp/big-photo.jpg /tmp/evil.svg /tmp/too-big.png
```

Delete the test images from the note, and remove any objects left in the local store
(`./.local-object-store` in the backend repo) or the Spaces bucket. Restore
`OBJECT_STORE_BACKEND` if you changed it for Case 17.
