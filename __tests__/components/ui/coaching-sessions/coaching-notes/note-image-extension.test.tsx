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
  uploadFilesInOrder,
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

function dispatchDragStart(target: HTMLElement): Event {
  const event = new Event("dragstart", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: {
      setData: vi.fn(),
      getData: vi.fn(() => ""),
      clearData: vi.fn(),
      setDragImage: vi.fn(),
      effectAllowed: "all",
    },
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
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

  // ProseMirror marks a *selected* node draggable for the length of a press, so a
  // dragstart really does fire when a selected image is dragged. What keeps the browser
  // from compositing a preview is that the dragstart is cancelled. This pins the
  // cancellation itself, since the protection lives in TipTap's NodeView.stopEvent
  // rather than in our code.
  it("cancels a native drag of the image node, whether or not it is selected", async () => {
    const { editor } = await mountEditor();
    insertImage(editor, "image-42", "a diagram");
    const pos = imageNodePosition(editor);
    const nodeDom = await waitFor(() => {
      const dom = editor.view.nodeDOM(pos);
      expect(dom).toBeInstanceOf(HTMLElement);
      return dom as HTMLElement;
    });

    expect(dispatchDragStart(nodeDom).defaultPrevented).toBe(true);

    act(() => {
      editor.commands.setNodeSelection(pos);
    });
    expect(dispatchDragStart(nodeDom).defaultPrevented).toBe(true);
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

    it("does not skip a deletion", () => {
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

  // Every file in a drop shares one anchor. Unless the anchor advances past each image
  // as it lands, every later image is inserted in front of the one before, and a drop of
  // A then B reads B, A.
  it("keeps a multi-file drop in the order the files were given", async () => {
    const { editor } = await mountEditor();
    const uploaded = (id: string) =>
      ok({
        id,
        coaching_session_id: SESSION_ID,
        mime_type: "image/png",
        byte_size: 3,
        width: None,
        height: None,
        created_at: DateTime.now(),
      });
    mockUpload
      .mockResolvedValueOnce(uploaded("image-a"))
      .mockResolvedValueOnce(uploaded("image-b"))
      .mockResolvedValueOnce(uploaded("image-c"));

    await act(async () => {
      await uploadFilesInOrder(
        editor,
        [makeFile("image/png"), makeFile("image/png"), makeFile("image/png")],
        uploadContext,
        editor.state.doc.content.size
      );
    });

    const ids: unknown[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === COACHING_NOTE_IMAGE_NAME) ids.push(node.attrs.imageId);
    });
    expect(ids).toEqual(["image-a", "image-b", "image-c"]);
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

describe("moving an image", () => {
  const BLOCK_HEIGHT = 80;
  const BLOCK_PITCH = 100;
  const VIEW_HEIGHT = 400;
  let layoutShift = 0;
  let blockReads = 0;
  let root: HTMLElement;
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => errors.push(event.error);

  // Stack the editor's top-level blocks 100px apart. jsdom lays nothing out, and the
  // move resolves its target from these rects. Reads are counted per block so the
  // tests can see how often layout is forced.
  function stackBlocks(editorRoot: HTMLElement) {
    root = editorRoot;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this === root) {
          return {
            top: 0,
            bottom: VIEW_HEIGHT,
            left: 0,
            right: 600,
            width: 600,
            height: VIEW_HEIGHT,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          } as DOMRect;
        }
        const index = Array.from(root.children).indexOf(this);
        if (index >= 0) blockReads += 1;
        const top = (index >= 0 ? index * BLOCK_PITCH : 0) + layoutShift;
        return {
          top,
          bottom: top + BLOCK_HEIGHT,
          left: 0,
          right: 600,
          width: 600,
          height: BLOCK_HEIGHT,
          x: 0,
          y: top,
          toJSON: () => ({}),
        } as DOMRect;
      }
    );
  }

  function pointer(
    type: string,
    target: Element,
    clientY: number,
    pointerType = "mouse",
    // Held through the gesture, released at its end.
    buttons = type === "pointerdown" || type === "pointermove" ? 1 : 0
  ) {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: 50,
      clientY,
      button: 0,
      buttons,
    });
    Object.defineProperty(event, "pointerId", { value: 1 });
    Object.defineProperty(event, "pointerType", { value: pointerType });
    act(() => {
      target.dispatchEvent(event);
    });
  }

  // A, image, B, C: the image is the second block, at y 100-180.
  async function mountStacked() {
    const harness = await mountEditor();
    act(() => {
      harness.editor.commands.setContent({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "A" }] },
          { type: COACHING_NOTE_IMAGE_NAME, attrs: { imageId: "image-42" } },
          { type: "paragraph", content: [{ type: "text", text: "B" }] },
          { type: "paragraph", content: [{ type: "text", text: "C" }] },
        ],
      });
    });
    const image = await waitFor(() => {
      const element = harness.container.querySelector("img");
      expect(element).toBeTruthy();
      return element as HTMLImageElement;
    });
    stackBlocks(harness.editor.view.dom as HTMLElement);
    return { ...harness, image };
  }

  function order(editor: Editor): string[] {
    return (editor.getJSON().content ?? []).map((node) =>
      node.type === COACHING_NOTE_IMAGE_NAME
        ? "IMAGE"
        : (node.content?.[0]?.text ?? "")
    );
  }

  function dropLine(): HTMLElement | null {
    return document.body.querySelector(":scope > .coaching-notes-dropcursor");
  }

  // Past the 5px threshold, so the press becomes a drag.
  function startDrag(image: Element) {
    pointer("pointerdown", image, 140);
    pointer("pointermove", image, 160);
  }

  beforeEach(() => {
    layoutShift = 0;
    blockReads = 0;
    errors.length = 0;
    mockMarkDeleted.mockReset();
    mockMarkDeleted.mockResolvedValue(ok(undefined));
    window.addEventListener("error", onError);
  });

  afterEach(() => {
    window.removeEventListener("error", onError);
    vi.restoreAllMocks();
    dropLine()?.remove();
  });

  it("moves the image to the drop line on release", async () => {
    const { editor, image } = await mountStacked();

    startDrag(image);
    pointer("pointermove", image, 370); // nearest edge: the bottom of C
    await frames(1);
    expect(dropLine()?.style.display).toBe("block");
    pointer("pointerup", image, 370);

    expect(order(editor)).toEqual(["A", "B", "C", "IMAGE"]);
    // One transaction, so the removal signal sees the same id before and after.
    expect(mockMarkDeleted).not.toHaveBeenCalled();
    expect(dropLine()?.style.display).toBe("none");
  });

  // The layout, for reference: A 0-80, IMAGE 100-180, B 200-280, C 300-380. The image's
  // own position is both "after A" (A's bottom, the image's top) and "before B" (the
  // image's bottom, B's top). A line at any of those four edges promises a move that
  // cannot happen: the image is already there.
  function lineEdge(): number | null {
    const line = dropLine();
    if (!line || line.style.display === "none") return null;
    return Math.round(parseFloat(line.style.top) + 1);
  }

  it("never draws the line at the image's own position", async () => {
    const { image } = await mountStacked();
    startDrag(image);

    const ownEdges = [80, 100, 180, 200];
    const seen: number[] = [];
    for (let y = 0; y <= 400; y += 10) {
      pointer("pointermove", image, y);
      await frames(1);
      const edge = lineEdge();
      if (edge !== null) seen.push(edge);
    }

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.filter((edge) => ownEdges.includes(edge))).toEqual([]);
  });

  // The gap under an image, and the top half of the block after it, are where a person
  // lets go to move an image down one place. Both used to resolve to where it already was.
  it.each([
    ["in the gap under the image", 190],
    ["on the upper half of the next block", 220],
  ])("moves the image down past the next block when released %s", async (_where, y) => {
    const { editor, image } = await mountStacked();
    startDrag(image);
    pointer("pointermove", image, y);
    await frames(1);
    pointer("pointerup", image, y);

    expect(order(editor)).toEqual(["A", "B", "IMAGE", "C"]);
  });

  it("moves the image up past the previous block when released just above it", async () => {
    const { editor, image } = await mountStacked();
    startDrag(image);
    pointer("pointermove", image, 90);
    await frames(1);
    pointer("pointerup", image, 90);

    expect(order(editor)).toEqual(["IMAGE", "A", "B", "C"]);
  });

  // Over the image itself there is nowhere to go: no line, and letting go does nothing.
  it("shows no line and moves nothing over the image itself", async () => {
    const { editor, image } = await mountStacked();
    startDrag(image);
    pointer("pointermove", image, 150);
    await frames(2);

    expect(lineEdge()).toBeNull();
    pointer("pointerup", image, 150);
    expect(order(editor)).toEqual(["A", "IMAGE", "B", "C"]);
  });

  // Cancel means the interaction was taken away (a scroll began, a system gesture),
  // not that anything was dropped.
  it("abandons the move when the pointer is cancelled", async () => {
    const { editor, image } = await mountStacked();

    startDrag(image);
    pointer("pointermove", image, 370);
    await frames(1);
    pointer("pointercancel", image, 370);

    expect(order(editor)).toEqual(["A", "IMAGE", "B", "C"]);
    expect(dropLine()?.style.display).toBe("none");
  });

  // A Mac trackpad can report the button released on a move before its pointerup. The
  // browser drops capture on that move, so the pointerup lands on whatever is under the
  // pointer, not the image. Recorded in Dia: line showing, image not moved, drag stuck.
  it("moves the image when the release lands on another block", async () => {
    const { editor, image, container } = await mountStacked();
    const blockC = container.querySelector(".tiptap > p:last-child") as HTMLElement;

    startDrag(image);
    pointer("pointermove", image, 370);
    await frames(1);
    pointer("pointerup", blockC, 370);

    expect(order(editor)).toEqual(["A", "B", "C", "IMAGE"]);
    expect(dropLine()?.style.display).toBe("none");
  });

  it("takes a move with the button already up as the release", async () => {
    const { editor, image } = await mountStacked();

    startDrag(image);
    pointer("pointermove", image, 370);
    await frames(1);
    pointer("pointermove", document.body, 370, "mouse", 0);

    expect(order(editor)).toEqual(["A", "B", "C", "IMAGE"]);
    expect(dropLine()?.style.display).toBe("none");
    // The pointerup that follows is not a second drop.
    pointer("pointerup", document.body, 5);
    expect(order(editor)).toEqual(["A", "B", "C", "IMAGE"]);
  });

  it("leaves the next press free to drag after a release elsewhere", async () => {
    const { editor, image, container } = await mountStacked();
    const blockC = container.querySelector(".tiptap > p:last-child") as HTMLElement;

    startDrag(image);
    pointer("pointermove", image, 370);
    pointer("pointerup", blockC, 370);
    const moved = await waitFor(() => {
      const element = container.querySelector("img");
      expect(element).toBeTruthy();
      return element as HTMLImageElement;
    });
    pointer("pointerdown", moved, 340);
    pointer("pointermove", moved, 320);
    pointer("pointermove", moved, 5);
    pointer("pointerup", blockC, 5);

    expect(order(editor)).toEqual(["IMAGE", "A", "B", "C"]);
  });

  // Reading every block's rect on every pointermove forces a synchronous layout per
  // block at pointer-event frequency. Layout is read once per animation frame instead,
  // however many pointer events arrive in between.
  it("reads layout once per frame, not once per pointer event", async () => {
    const { image } = await mountStacked();
    startDrag(image);
    await frames(1);

    const beforeBurst = blockReads;
    for (let y = 170; y < 370; y += 5) pointer("pointermove", image, y);
    expect(blockReads).toBe(beforeBurst);

    await frames(1);
    expect(blockReads).toBeGreaterThan(beforeBurst);
    expect(blockReads - beforeBurst).toBeLessThanOrEqual(4 * 2);
  });

  // The line is positioned against the viewport, so anything that moves the blocks
  // mid-drag (a scroll, an image finishing loading) has to move the line with them.
  it("follows the blocks when they move mid-drag", async () => {
    const { image } = await mountStacked();

    startDrag(image);
    pointer("pointermove", image, 370);
    await frames(1);
    const lineBefore = dropLine()?.style.top;

    layoutShift = -50;
    await frames(1);

    expect(dropLine()?.style.top).not.toBe(lineBefore);
  });

  it("does not start a move from inside the description field", async () => {
    const { editor, container } = await mountStacked();
    act(() => {
      editor.commands.setNodeSelection(imageNodePosition(editor));
    });
    const field = await waitFor(() => {
      const input = container.querySelector('input[aria-label="Image description"]');
      expect(input).toBeTruthy();
      return input as HTMLInputElement;
    });

    // Drag-selecting text in the field.
    pointer("pointerdown", field, 140);
    pointer("pointermove", field, 370);
    pointer("pointerup", field, 370);

    expect(order(editor)).toEqual(["A", "IMAGE", "B", "C"]);
    expect(dropLine()?.style.display ?? "none").toBe("none");
  });

  // Moving an image up lets ProseMirror reuse its node view rather than recreate it,
  // without calling update(). TipTap's node view caches its position and checks later
  // selections against that cache, so it would deselect itself the moment it was
  // selected at its new place, and the description field could never be reached.
  it("can still be selected after it has been moved up", async () => {
    const { editor, image, container } = await mountStacked();

    startDrag(image);
    pointer("pointermove", image, 5); // nearest edge: the top of A
    pointer("pointerup", image, 5);
    expect(order(editor)).toEqual(["IMAGE", "A", "B", "C"]);

    act(() => {
      editor.commands.setNodeSelection(imageNodePosition(editor));
    });
    // TipTap reconciles node-view selection on the next animation frame.
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    });

    expect(container.querySelector(".note-image.is-selected")).toBeTruthy();
    expect(
      container.querySelector('input[aria-label="Image description"]')
    ).toBeTruthy();
  });

  // The note scrolls inside its own container, often with only a few hundred pixels
  // showing. Without scrolling at the edges, anything out of view is unreachable by drag.
  function makeScrollable(editorRoot: HTMLElement) {
    let top = 0;
    editorRoot.style.overflowY = "auto";
    Object.defineProperty(editorRoot, "clientHeight", { configurable: true, value: VIEW_HEIGHT });
    Object.defineProperty(editorRoot, "scrollHeight", { configurable: true, value: 1200 });
    Object.defineProperty(editorRoot, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = Math.max(0, Math.min(value, 1200 - VIEW_HEIGHT));
      },
    });
    return () => top;
  }

  const frames = (count: number) =>
    act(async () => {
      for (let i = 0; i < count; i++) {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      }
    });

  it("scrolls the note while the pointer is held at its bottom edge", async () => {
    const { editor, image } = await mountStacked();
    const scrollTop = makeScrollable(editor.view.dom as HTMLElement);

    startDrag(image);
    pointer("pointermove", image, VIEW_HEIGHT - 4);
    await frames(10);
    const whileHeld = scrollTop();

    expect(whileHeld).toBeGreaterThan(0);
  });

  it("scrolls up at the top edge, and not at all away from the edges", async () => {
    const { editor, image } = await mountStacked();
    const scrollTop = makeScrollable(editor.view.dom as HTMLElement);
    const root = editor.view.dom as HTMLElement;
    root.scrollTop = 300;

    startDrag(image);
    pointer("pointermove", image, VIEW_HEIGHT / 2);
    await frames(10);
    expect(scrollTop()).toBe(300);

    pointer("pointermove", image, 4);
    await frames(10);
    expect(scrollTop()).toBeLessThan(300);
  });

  // The note's own container can run out while the page still has room; the drag
  // should carry on scrolling whatever can still move.
  it("hands off to an outer container once the note's own runs out", async () => {
    const { editor, image } = await mountStacked();
    const root = editor.view.dom as HTMLElement;
    makeScrollable(root);
    root.scrollTop = 1200 - VIEW_HEIGHT; // the note is already at its bottom
    const outer = root.parentElement as HTMLElement;
    const outerTop = makeScrollable(outer);

    startDrag(image);
    pointer("pointermove", image, VIEW_HEIGHT - 4);
    await frames(10);

    expect(outerTop()).toBeGreaterThan(0);
  });

  it("stops scrolling once the drag ends", async () => {
    const { editor, image } = await mountStacked();
    const scrollTop = makeScrollable(editor.view.dom as HTMLElement);

    startDrag(image);
    pointer("pointermove", image, VIEW_HEIGHT - 4);
    await frames(5);
    pointer("pointercancel", image, VIEW_HEIGHT - 4);
    const atEnd = scrollTop();
    await frames(10);

    expect(scrollTop()).toBe(atEnd);
  });

  // A finger over an image is scrolling the note; taking the gesture over would leave
  // a note full of images unscrollable on a phone.
  it("leaves touch to scrolling", async () => {
    const { editor, image } = await mountStacked();

    pointer("pointerdown", image, 140, "touch");
    pointer("pointermove", image, 370, "touch");
    pointer("pointerup", image, 370, "touch");

    expect(order(editor)).toEqual(["A", "IMAGE", "B", "C"]);
  });
});
