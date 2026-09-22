import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import * as Y from "yjs";
import { Some } from "@/types/option";
import { err, ok } from "neverthrow";
import { DateTime } from "ts-luxon";
import { None } from "@/types/option";

const mockUpload = vi.fn();

vi.mock("@/lib/api/coaching-session-images", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/api/coaching-session-images")
  >();
  return {
    ...actual,
    CoachingSessionImageApi: {
      ...actual.CoachingSessionImageApi,
      upload: (...args: unknown[]) => mockUpload(...args),
    },
  };
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

import { Extensions } from "@/components/ui/coaching-sessions/coaching-notes/extensions";
import {
  COACHING_NOTE_IMAGE_NAME,
  sanitizePastedHtml,
  uploadAndInsertImage,
} from "@/components/ui/coaching-sessions/coaching-notes/note-image-extension";
import { CoachingSessionImageApi, UploadFailureKind } from "@/lib/api/coaching-session-images";
import { shouldShowSelectionMenu } from "@/components/ui/tiptap-ui/selection-bubble-menu/selection-bubble-menu";

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

function makeFile(type: string): File {
  return new File([new Uint8Array([1, 2, 3])], "shot.png", { type });
}

describe("Coaching note image extension", () => {
  beforeEach(() => {
    mockUpload.mockReset();
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

  it("reports when something was stripped and when nothing was", () => {
    expect(sanitizePastedHtml("<p>plain</p>").stripped).toBe(false);
    expect(sanitizePastedHtml('<img src="https://example.com/a.png" />').stripped).toBe(
      true
    );
  });
});
