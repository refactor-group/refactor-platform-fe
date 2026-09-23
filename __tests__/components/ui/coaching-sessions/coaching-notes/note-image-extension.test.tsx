import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import type { TiptapCollabProvider } from "@hocuspocus/provider";
import { Some } from "@/types/option";
import { err, ok } from "neverthrow";
import { DateTime } from "ts-luxon";
import { None } from "@/types/option";

const mockUpload = vi.fn();
const mockMarkDeleted = vi.fn();
const mockRestore = vi.fn();

vi.mock("@/lib/api/coaching-session-images", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/api/coaching-session-images")
  >();
  return {
    ...actual,
    CoachingSessionImageApi: {
      ...actual.CoachingSessionImageApi,
      upload: (...args: unknown[]) => mockUpload(...args),
      markDeleted: (...args: unknown[]) => mockMarkDeleted(...args),
      restore: (...args: unknown[]) => mockRestore(...args),
    },
  };
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

import { Extensions } from "@/components/ui/coaching-sessions/coaching-notes/extensions";
import {
  COACHING_NOTE_IMAGE_NAME,
  sanitizePastedHtml,
  stepCanChangeImages,
  uploadAndInsertImage,
} from "@/components/ui/coaching-sessions/coaching-notes/note-image-extension";
import { ReplaceStep } from "@tiptap/pm/transform";
import { Slice, Fragment } from "@tiptap/pm/model";
import { CoachingSessionImageApi, UploadFailureKind } from "@/lib/api/coaching-session-images";
import { shouldShowSelectionMenu } from "@/components/ui/tiptap-ui/selection-bubble-menu/selection-bubble-menu";
import { ySyncPluginKey, yUndoPluginKey } from "@tiptap/y-tiptap";
import { toast } from "sonner";

const SESSION_ID = "session-1";
const MAX_BYTES = 10 * 1024 * 1024;
const uploadContext = { coachingSessionId: SESSION_ID, maxBytes: MAX_BYTES };

interface Harness {
  container: HTMLElement;
  editor: Editor;
}

async function mountEditor(): Promise<Harness> {
  const ref: { current: Editor | null } = { current: null };

  const TestEditor = () => {
    const editor = useEditor({
      extensions: Extensions(new Y.Doc(), null, undefined, Some(uploadContext)),
      content: "<p>notes</p>",
      immediatelyRender: false,
    });
    ref.current = editor;
    return editor ? <EditorContent editor={editor} /> : null;
  };

  const { container } = render(<TestEditor />);
  await waitFor(() => {
    if (!ref.current) throw new Error("editor not ready");
  });
  return { container, editor: ref.current as Editor };
}

// Undo only exists under collaboration: the editor ships no history extension,
// and y-undo replays through the same y-sync path a remote edit arrives on.
async function mountCollaborativeEditor(): Promise<Harness> {
  const ref: { current: Editor | null } = { current: null };
  const doc = new Y.Doc();
  const provider = {
    awareness: new Awareness(doc),
  } as unknown as TiptapCollabProvider;

  const TestEditor = () => {
    const editor = useEditor({
      extensions: Extensions(
        doc,
        provider,
        { name: "Coach", color: "#000000" },
        Some(uploadContext)
      ),
      immediatelyRender: false,
    });
    ref.current = editor;
    return editor ? <EditorContent editor={editor} /> : null;
  };

  const { container } = render(<TestEditor />);
  await waitFor(() => {
    if (!ref.current) throw new Error("editor not ready");
  });
  return { container, editor: ref.current as Editor };
}

function insertImage(editor: Editor, imageId: string, alt = "") {
  act(() => {
    editor.commands.insertContent({
      type: COACHING_NOTE_IMAGE_NAME,
      attrs: { imageId, alt },
    });
  });
}

function imageAttrsFromDoc(editor: Editor): Record<string, unknown> {
  const json = editor.getJSON();
  const node = json.content?.find(
    (child) => child.type === COACHING_NOTE_IMAGE_NAME
  );
  if (!node) throw new Error("no image node in document");
  return node.attrs ?? {};
}

function imageNodePosition(editor: Editor): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === COACHING_NOTE_IMAGE_NAME && found === -1) {
      found = pos;
    }
    return found === -1;
  });
  if (found === -1) throw new Error("no image node in document");
  return found;
}

function selectImage(editor: Editor) {
  act(() => {
    editor.commands.setNodeSelection(imageNodePosition(editor));
  });
}

function pressBackspace(editor: Editor) {
  act(() => {
    const event = new KeyboardEvent("keydown", {
      key: "Backspace",
      keyCode: 8,
    });
    editor.view.someProp("handleKeyDown", (handler) =>
      handler(editor.view, event)
    );
  });
}

function makeFile(type: string): File {
  return new File([new Uint8Array([1, 2, 3])], "shot.png", { type });
}

describe("Coaching note image extension", () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockMarkDeleted.mockReset();
    mockMarkDeleted.mockResolvedValue(ok(undefined));
    mockRestore.mockReset();
    mockRestore.mockResolvedValue(ok(undefined));
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.loading).mockClear();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.dismiss).mockClear();
  });

  it("renders the image-scoped backend URL while storing only the image id", async () => {
    const { container, editor } = await mountEditor();
    insertImage(editor, "image-42", "a diagram");

    await waitFor(() => {
      const image = container.querySelector("img");
      expect(image).toBeTruthy();
      expect(image?.getAttribute("src")).toBe(
        CoachingSessionImageApi.imageUrl("image-42")
      );
    });

    const attrs = imageAttrsFromDoc(editor);
    expect(attrs.imageId).toBe("image-42");
    expect(attrs).not.toHaveProperty("src");
  });

  // The browser composites a drag preview from whatever is being dragged, and there is
  // no portable way to suppress it. Nothing is natively draggable, so nothing is ever
  // composited: the node view moves the node with pointer events instead.
  it("makes nothing in the image natively draggable", async () => {
    const { container, editor } = await mountEditor();
    insertImage(editor, "image-42", "a diagram");

    await waitFor(() => {
      const image = container.querySelector("img");
      expect(image).toBeTruthy();
      expect(image?.getAttribute("draggable")).toBe("false");
      expect(image?.closest("[data-drag-handle]")).toBeNull();
      expect(container.querySelector('[draggable="true"]')).toBeNull();
    });
  });

  it("declares the node undraggable so ProseMirror installs no drag handling", async () => {
    const { editor } = await mountEditor();

    expect(editor.schema.nodes[COACHING_NOTE_IMAGE_NAME].spec.draggable).toBe(false);
  });

  it("starts no native drag when the image is pressed and moved", async () => {
    const { container, editor } = await mountEditor();
    insertImage(editor, "image-42", "a diagram");

    const image = await waitFor(() => {
      const element = container.querySelector("img");
      expect(element).toBeTruthy();
      return element as HTMLImageElement;
    });

    const dragStarts: Event[] = [];
    document.addEventListener("dragstart", (e) => dragStarts.push(e));

    act(() => {
      image.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10, button: 0 })
      );
      image.dispatchEvent(
        new MouseEvent("pointermove", { bubbles: true, clientX: 90, clientY: 200, button: 0 })
      );
      image.dispatchEvent(
        new MouseEvent("pointerup", { bubbles: true, clientX: 90, clientY: 200, button: 0 })
      );
    });

    expect(dragStarts).toHaveLength(0);
  });

  it("serializes a document containing an image to markdown without throwing", async () => {
    const { editor } = await mountEditor();
    insertImage(editor, "image-42", "a diagram");

    let markdown = "";
    expect(() => {
      markdown = editor.getMarkdown();
    }).not.toThrow();
    expect(markdown).toContain(
      `![a diagram](${CoachingSessionImageApi.imageUrl("image-42")})`
    );
  });

  it("contributes no text, so the selection bubble menu stays hidden", async () => {
    const { editor } = await mountEditor();
    insertImage(editor, "image-42", "a diagram");

    const from = imageNodePosition(editor);
    const to = from + 1;

    expect(editor.state.doc.textBetween(from, to, " ")).toBe("");
    expect(shouldShowSelectionMenu({ editor, from, to })).toBe(false);
  });

  it("leaves the document byte-identical when the upload fails", async () => {
    const { editor } = await mountEditor();
    mockUpload.mockResolvedValue(
      err({ kind: UploadFailureKind.Network, status: None })
    );

    const before = editor.getJSON();
    await act(async () => {
      await uploadAndInsertImage(editor, makeFile("image/png"), uploadContext);
    });

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(editor.getJSON()).toEqual(before);
  });

  it("never uploads a rejected file and leaves the document unchanged", async () => {
    const { editor } = await mountEditor();

    const before = editor.getJSON();
    await act(async () => {
      await uploadAndInsertImage(
        editor,
        makeFile("application/pdf"),
        uploadContext
      );
    });

    expect(mockUpload).not.toHaveBeenCalled();
    expect(editor.getJSON()).toEqual(before);
  });

  it("inserts the node once the upload succeeds", async () => {
    const { editor } = await mountEditor();
    mockUpload.mockResolvedValue(
      ok({
        id: "image-99",
        coaching_session_id: SESSION_ID,
        mime_type: "image/png",
        byte_size: 3,
        width: None,
        height: None,
        created_at: DateTime.now(),
      })
    );

    await act(async () => {
      await uploadAndInsertImage(editor, makeFile("image/png"), uploadContext);
    });

    expect(imageAttrsFromDoc(editor).imageId).toBe("image-99");
  });

  it("strips foreign images and inline SVG from pasted HTML", async () => {
    const { editor } = await mountEditor();
    const ownUrl = CoachingSessionImageApi.imageUrl("image-42");
    const html =
      `<p>before</p>` +
      `<img src="https://lh3.googleusercontent.com/abc" />` +
      `<svg><script>alert(1)</script></svg>` +
      `<img src="${ownUrl}" data-image-id="image-42" />`;

    const transformed = editor.view.someProp("transformPastedHTML", (fn) =>
      fn(html, editor.view)
    );

    expect(transformed).toBeTypeOf("string");
    expect(transformed).not.toContain("googleusercontent.com");
    expect(transformed).not.toContain("<svg");
    expect(transformed).toContain(ownUrl);
  });

  // Google Docs wraps each image in its own paragraph, so leaving the wrapper behind
  // turns a doc full of images into a run of blank lines.
  it("removes the paragraph a stripped image leaves empty", () => {
    const { html } = sanitizePastedHtml(
      `<p>AAA</p>` +
        `<p><img src="https://lh3.googleusercontent.com/x1" /></p>` +
        `<p><img src="https://lh3.googleusercontent.com/x2" /></p>` +
        `<p>BBB</p>`
    );

    expect(html).toBe("<p>AAA</p><p>BBB</p>");
  });

  it("keeps a wrapper that still holds text after the image goes", () => {
    const { html } = sanitizePastedHtml(
      `<p>caption <img src="https://lh3.googleusercontent.com/x1" /></p>`
    );

    expect(html).toBe("<p>caption </p>");
  });

  // An empty cell still carries meaning: pruning it would shift every later cell left.
  it("keeps an emptied table cell", () => {
    const { html } = sanitizePastedHtml(
      `<table><tbody><tr><td><img src="https://lh3.googleusercontent.com/x1" /></td><td>next</td></tr></tbody></table>`
    );

    expect(html).toContain("<td></td>");
    expect(html).toContain("<td>next</td>");
  });

  // The removal signal walks the document twice per transaction. Typing must not pay
  // that: a keystroke is a ReplaceStep with from === to, so testing the step type alone
  // is true for every keystroke and skips nothing at all.
  describe("removal signal step guard", () => {
    it("skips a keystroke", async () => {
      const { editor } = await mountEditor();
      const at = editor.state.doc.content.size - 1;
      const typing = new ReplaceStep(
        at,
        at,
        new Slice(Fragment.from(editor.schema.text("x")), 0, 0)
      );

      expect(typing.from).toBe(typing.to);
      expect(stepCanChangeImages(typing)).toBe(false);
    });

    it("does not skip a deletion", async () => {
      const { editor } = await mountEditor();
      const deletion = new ReplaceStep(1, 3, Slice.empty);

      expect(stepCanChangeImages(deletion)).toBe(true);
    });

    // The restore branch needs an insertion detected, or undo of a removal is missed.
    it("does not skip inserting an image", async () => {
      const { editor } = await mountEditor();
      const image = editor.schema.nodes[COACHING_NOTE_IMAGE_NAME].create({
        imageId: "66666666-6666-4666-8666-666666666666",
      });
      const at = editor.state.doc.content.size - 1;
      const insertion = new ReplaceStep(
        at,
        at,
        new Slice(Fragment.from(image), 0, 0)
      );

      expect(insertion.from).toBe(insertion.to);
      expect(stepCanChangeImages(insertion)).toBe(true);
    });

    it("does not skip a step it cannot introspect", () => {
      expect(stepCanChangeImages({} as never)).toBe(true);
    });
  });

  // The upload resolves long after the drop, and the document moves underneath it.
  // insertContentAt resolves the position against the current document with no clamping,
  // so a stale position past the end throws RangeError out of a floating promise: an
  // upload already paid for, lost with no error shown.
  it("still inserts when the document shrank during the upload", async () => {
    const { editor } = await mountEditor();
    act(() => {
      editor.commands.setContent("<p>aaaa</p><p>bbbb</p><p>cccc</p>");
    });
    const dropPos = editor.state.doc.content.size - 1;

    let release!: (value: unknown) => void;
    mockUpload.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );

    const pending = uploadAndInsertImage(
      editor,
      makeFile("image/png"),
      uploadContext,
      dropPos
    );

    // Everything after the drop point goes away while the upload is in flight.
    act(() => {
      editor.commands.setContent("<p>a</p>");
    });

    release(
      ok({
        id: "55555555-5555-4555-8555-555555555555",
        coaching_session_id: SESSION_ID,
        mime_type: "image/png",
        byte_size: 3,
        width: None,
        height: None,
        created_at: DateTime.now(),
      })
    );

    await act(async () => {
      await expect(pending).resolves.toBeUndefined();
    });

    expect(imageAttrsFromDoc(editor).imageId).toBe(
      "55555555-5555-4555-8555-555555555555"
    );
  });

  // A pasted data-image-id is interpolated into credentialed request paths, so an id
  // like "../../users/<id>" would escape the images collection and issue an
  // authenticated request against an unrelated endpoint.
  it("refuses a pasted image id that is not a uuid", async () => {
    const { editor } = await mountEditor();
    const ownUrl = CoachingSessionImageApi.imageUrl(
      "11111111-1111-4111-8111-111111111111"
    );
    const hostile = `<img src="${ownUrl}" data-image-id="../../users/99" />`;

    const transformed = editor.view.someProp("transformPastedHTML", (fn) =>
      fn(hostile, editor.view)
    ) as string;
    act(() => {
      editor.commands.setContent(transformed);
    });

    const ids: unknown[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === COACHING_NOTE_IMAGE_NAME) ids.push(node.attrs.imageId);
    });
    expect(ids).not.toContain("../../users/99");
    ids.forEach((id) => expect(id).toBe(""));
  });

  it("accepts a pasted image id that is a uuid", async () => {
    const { editor } = await mountEditor();
    const id = "11111111-1111-4111-8111-111111111111";
    const ownUrl = CoachingSessionImageApi.imageUrl(id);

    const transformed = editor.view.someProp("transformPastedHTML", (fn) =>
      fn(`<img src="${ownUrl}" data-image-id="${id}" />`, editor.view)
    ) as string;
    act(() => {
      editor.commands.setContent(transformed);
    });

    const ids: unknown[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === COACHING_NOTE_IMAGE_NAME) ids.push(node.attrs.imageId);
    });
    expect(ids).toEqual([id]);
  });

  // The row an image names is governed by its own session's lifecycle: removing it there
  // marks the row deleted, and the purge would destroy bytes this note still shows.
  it("strips a pasted image belonging to another coaching session", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const ownUrl = CoachingSessionImageApi.imageUrl(id);

    const result = sanitizePastedHtml(
      `<p>keep</p><img src="${ownUrl}" data-image-id="${id}" data-coaching-session-id="some-other-session" />`,
      SESSION_ID
    );

    expect(result.strippedOtherSession).toBe(true);
    expect(result.html).not.toContain(id);
    expect(result.html).toContain("keep");
  });

  it("keeps a pasted image belonging to this coaching session", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const ownUrl = CoachingSessionImageApi.imageUrl(id);

    const result = sanitizePastedHtml(
      `<img src="${ownUrl}" data-image-id="${id}" data-coaching-session-id="${SESSION_ID}" />`,
      SESSION_ID
    );

    expect(result.strippedOtherSession).toBe(false);
    expect(result.html).toContain(id);
  });

  // Nodes written before the attribute existed carry no owner; stripping those would
  // silently empty existing notes on any copy/paste.
  it("keeps a pasted image with no recorded session", () => {
    const id = "44444444-4444-4444-8444-444444444444";
    const ownUrl = CoachingSessionImageApi.imageUrl(id);

    const result = sanitizePastedHtml(
      `<img src="${ownUrl}" data-image-id="${id}" />`,
      SESSION_ID
    );

    expect(result.strippedOtherSession).toBe(false);
    expect(result.html).toContain(id);
  });

  it("reports when something was stripped and when nothing was", () => {
    expect(sanitizePastedHtml("<p>plain</p>").stripped).toBe(false);
    expect(sanitizePastedHtml('<img src="https://example.com/a.png" />').stripped).toBe(
      true
    );
  });

  it("signals removal once when the delete control removes the node", async () => {
    const { editor } = await mountEditor();
    insertImage(editor, "image-42");

    selectImage(editor);
    act(() => {
      editor.commands.deleteSelection();
    });

    expect(mockMarkDeleted).toHaveBeenCalledTimes(1);
    expect(mockMarkDeleted).toHaveBeenCalledWith("image-42");
  });

  it("signals removal when the node is deleted with backspace", async () => {
    const { editor } = await mountEditor();
    insertImage(editor, "image-42");
    // Cursor at the start of the paragraph after the image: the first press
    // selects the image, the second deletes it.
    act(() => {
      editor.commands.setTextSelection(imageNodePosition(editor) + 2);
    });

    pressBackspace(editor);
    pressBackspace(editor);

    expect(mockMarkDeleted).toHaveBeenCalledWith("image-42");
  });

  it("restores the same image id when the removal is undone", async () => {
    const { editor } = await mountCollaborativeEditor();
    insertImage(editor, "image-42");
    // Without a capture boundary the insert and the removal share one undo step.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    yUndoPluginKey.getState(editor.state)?.undoManager.stopCapturing();

    selectImage(editor);
    act(() => {
      editor.commands.deleteSelection();
    });
    act(() => {
      editor.commands.undo();
    });

    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(mockRestore).toHaveBeenCalledWith("image-42");
  });

  it("signals nothing for a transaction that removes no image", async () => {
    const { editor } = await mountEditor();
    insertImage(editor, "image-42");

    act(() => {
      editor.commands.insertContent("more notes");
    });

    expect(mockMarkDeleted).not.toHaveBeenCalled();
    expect(mockRestore).not.toHaveBeenCalled();
  });

  it("signals both images removed by a single transaction", async () => {
    const { editor } = await mountEditor();
    insertImage(editor, "image-1");
    insertImage(editor, "image-2");

    act(() => {
      editor.chain().selectAll().deleteSelection().run();
    });

    expect(mockMarkDeleted).toHaveBeenCalledTimes(2);
    expect(mockMarkDeleted).toHaveBeenCalledWith("image-1");
    expect(mockMarkDeleted).toHaveBeenCalledWith("image-2");
  });

  it("signals nothing when the removal arrives from the other participant", async () => {
    const { editor } = await mountEditor();
    insertImage(editor, "image-42");

    const pos = imageNodePosition(editor);
    act(() => {
      editor.view.dispatch(
        editor.state.tr
          .delete(pos, pos + 1)
          .setMeta(ySyncPluginKey, { isChangeOrigin: true })
      );
    });

    expect(mockMarkDeleted).not.toHaveBeenCalled();
    expect(mockRestore).not.toHaveBeenCalled();
  });

  it("leaves the document byte-identical and silent when the signal fails", async () => {
    const { editor } = await mountEditor();
    const before = editor.getJSON();
    mockMarkDeleted.mockResolvedValue(
      err({ kind: UploadFailureKind.Network, status: None })
    );

    insertImage(editor, "image-42");
    selectImage(editor);
    await act(async () => {
      editor.commands.deleteSelection();
    });

    expect(mockMarkDeleted).toHaveBeenCalledTimes(1);
    expect(editor.getJSON()).toEqual(before);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("never restores an image this editor did not remove", async () => {
    const { editor } = await mountEditor();

    insertImage(editor, "image-42");

    expect(mockRestore).not.toHaveBeenCalled();
  });

  describe("upload notifications", () => {
    // Comfortably past the in-progress delay, so the test never encodes its exact value.
    const PAST_THE_DELAY_MS = 2000;

    function uploaded(id: string) {
      return ok({
        id,
        coaching_session_id: SESSION_ID,
        mime_type: "image/png",
        byte_size: 3,
        width: None,
        height: None,
        created_at: DateTime.now(),
      });
    }

    function deferredUpload() {
      let settle!: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        settle = resolve;
      });
      mockUpload.mockReturnValue(promise);
      return settle;
    }

    async function letTheDelayElapse() {
      await act(async () => {
        vi.advanceTimersByTime(PAST_THE_DELAY_MS);
      });
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows no toast at all when the upload finishes before the delay", async () => {
      const { editor } = await mountEditor();
      vi.useFakeTimers();
      mockUpload.mockResolvedValue(uploaded("image-99"));

      await act(async () => {
        await uploadAndInsertImage(editor, makeFile("image/png"), uploadContext);
      });

      expect(toast.loading).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(imageAttrsFromDoc(editor).imageId).toBe("image-99");
    });

    it("never announces success, on any path", async () => {
      // A fresh editor per path: jsdom cannot scroll a second image node into view.
      const fast = await mountEditor();
      vi.useFakeTimers();
      mockUpload.mockResolvedValue(uploaded("image-fast"));
      await act(async () => {
        await uploadAndInsertImage(
          fast.editor,
          makeFile("image/png"),
          uploadContext
        );
      });

      vi.useRealTimers();
      const slowHarness = await mountEditor();
      vi.useFakeTimers();
      const finishUpload = deferredUpload();
      const slow = uploadAndInsertImage(
        slowHarness.editor,
        makeFile("image/png"),
        uploadContext
      );
      await letTheDelayElapse();
      finishUpload(uploaded("image-slow"));
      await act(async () => {
        await slow;
      });

      mockUpload.mockResolvedValue(
        err({ kind: UploadFailureKind.Network, status: None })
      );
      await act(async () => {
        await uploadAndInsertImage(
          fast.editor,
          makeFile("image/png"),
          uploadContext
        );
      });

      await act(async () => {
        await uploadAndInsertImage(
          fast.editor,
          makeFile("application/pdf"),
          uploadContext
        );
      });

      expect(toast.success).not.toHaveBeenCalled();
    });

    it("shows then dismisses the in-progress toast when the upload is slow", async () => {
      const { editor } = await mountEditor();
      vi.useFakeTimers();
      const finishUpload = deferredUpload();

      const pending = uploadAndInsertImage(
        editor,
        makeFile("image/png"),
        uploadContext
      );
      await letTheDelayElapse();

      expect(toast.loading).toHaveBeenCalledWith("Adding image");

      finishUpload(uploaded("image-99"));
      await act(async () => {
        await pending;
      });

      expect(toast.dismiss).toHaveBeenCalledWith("toast-id");
      expect(toast.success).not.toHaveBeenCalled();
      expect(imageAttrsFromDoc(editor).imageId).toBe("image-99");
    });

    it("shows only the error toast when a fast upload fails", async () => {
      const { editor } = await mountEditor();
      vi.useFakeTimers();
      mockUpload.mockResolvedValue(
        err({ kind: UploadFailureKind.Network, status: None })
      );

      await act(async () => {
        await uploadAndInsertImage(editor, makeFile("image/png"), uploadContext);
      });

      expect(toast.loading).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(expect.any(String), undefined);
    });

    it("replaces the in-progress toast with the error when a slow upload fails", async () => {
      const { editor } = await mountEditor();
      vi.useFakeTimers();
      const finishUpload = deferredUpload();

      const pending = uploadAndInsertImage(
        editor,
        makeFile("image/png"),
        uploadContext
      );
      await letTheDelayElapse();

      expect(toast.loading).toHaveBeenCalledWith("Adding image");

      finishUpload(err({ kind: UploadFailureKind.Network, status: None }));
      await act(async () => {
        await pending;
      });

      expect(toast.error).toHaveBeenCalledWith(expect.any(String), {
        id: "toast-id",
      });
    });

    it("rejects an unsupported file without ever starting an in-progress toast", async () => {
      const { editor } = await mountEditor();
      vi.useFakeTimers();

      await act(async () => {
        await uploadAndInsertImage(
          editor,
          makeFile("application/pdf"),
          uploadContext
        );
      });
      await letTheDelayElapse();

      expect(mockUpload).not.toHaveBeenCalled();
      expect(toast.loading).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledTimes(1);
    });
  });
});
