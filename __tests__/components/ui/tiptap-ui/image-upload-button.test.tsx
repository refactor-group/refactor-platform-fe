import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import * as Y from "yjs";
import { Some, None, type Option } from "@/types/option";

const mockUploadFilesInOrder = vi.fn();

vi.mock(
  "@/components/ui/coaching-sessions/coaching-notes/note-image-extension",
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import("@/components/ui/coaching-sessions/coaching-notes/note-image-extension")
    >();
    return {
      ...actual,
      uploadFilesInOrder: (...args: unknown[]) =>
        mockUploadFilesInOrder(...args),
    };
  }
);

import { Extensions } from "@/components/ui/coaching-sessions/coaching-notes/extensions";
import type { NoteImageUploadContext } from "@/components/ui/coaching-sessions/coaching-notes/note-image-extension";
import {
  ImageUploadButton,
  canInsertImage,
  isImageUploadButtonDisabled,
  shouldShowImageUploadButton,
} from "@/components/ui/tiptap-ui/image-upload-button";
import { TooltipProvider } from "@/components/ui/tooltip";

const uploadContext: NoteImageUploadContext = {
  coachingSessionId: "session-1",
  maxBytes: 10 * 1024 * 1024,
};

interface Harness {
  container: HTMLElement;
  editor: Editor;
}

async function mountButton(
  imageContext: Option<NoteImageUploadContext>
): Promise<Harness> {
  const ref: { current: Editor | null } = { current: null };

  const TestEditor = () => {
    const editor = useEditor({
      extensions: Extensions(new Y.Doc(), null, undefined, imageContext),
      content: "<p>notes</p>",
      immediatelyRender: false,
    });
    ref.current = editor;
    return editor ? (
      <ImageUploadButton editor={editor} context={uploadContext} />
    ) : null;
  };

  const { container } = render(
    <TooltipProvider>
      <TestEditor />
    </TooltipProvider>
  );
  await waitFor(() => {
    if (!ref.current) throw new Error("editor not ready");
  });
  return { container, editor: ref.current as Editor };
}

function fileInputFrom(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input rendered");
  return input;
}

/** jsdom always reports "" for a file input's value, so stand in a real one. */
function trackValue(input: HTMLInputElement, initial: string) {
  let current = initial;
  Object.defineProperty(input, "value", {
    configurable: true,
    get: () => current,
    set: (next: string) => {
      current = next;
    },
  });
}

function selectFile(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", { configurable: true, value: files });
  fireEvent.change(input);
}

describe("ImageUploadButton", () => {
  beforeEach(() => {
    mockUploadFilesInOrder.mockReset();
  });

  describe("pure predicates", () => {
    it("cannot insert without an editor", () => {
      expect(canInsertImage(null)).toBe(false);
    });

    it("cannot insert when the image node is absent from the schema", async () => {
      const { editor } = await mountButton(None);
      expect(canInsertImage(editor)).toBe(false);
    });

    it("can insert when the image extension is configured", async () => {
      const { editor } = await mountButton(Some(uploadContext));
      expect(canInsertImage(editor)).toBe(true);
    });

    it("is disabled without an editor and when the caller disables it", async () => {
      expect(isImageUploadButtonDisabled(null, true)).toBe(true);

      const { editor } = await mountButton(Some(uploadContext));
      expect(isImageUploadButtonDisabled(editor, true, true)).toBe(true);
      expect(isImageUploadButtonDisabled(editor, true, false)).toBe(false);
    });

    it("hides when asked to and the node is absent, otherwise shows", async () => {
      const { editor } = await mountButton(Some(uploadContext));

      expect(
        shouldShowImageUploadButton({
          editor,
          hideWhenUnavailable: true,
          nodeInSchema: false,
        })
      ).toBe(false);

      expect(
        shouldShowImageUploadButton({
          editor,
          hideWhenUnavailable: false,
          nodeInSchema: true,
        })
      ).toBe(true);
    });
  });

  describe("component", () => {
    it("has an accessible name of Insert image", async () => {
      await mountButton(Some(uploadContext));
      expect(
        screen.getByRole("button", { name: "Insert image" })
      ).toBeInTheDocument();
    });

    it("hands a selected file to the upload path with the supplied context", async () => {
      const { container, editor } = await mountButton(Some(uploadContext));
      const file = new File(["png-bytes"], "shot.png", { type: "image/png" });

      selectFile(fileInputFrom(container), [file]);

      expect(mockUploadFilesInOrder).toHaveBeenCalledTimes(1);
      expect(mockUploadFilesInOrder).toHaveBeenCalledWith(
        editor,
        [file],
        uploadContext
      );
    });

    it("resets the input so the same file can be picked again", async () => {
      const { container } = await mountButton(Some(uploadContext));
      const input = fileInputFrom(container);
      trackValue(input, "C:\\fakepath\\shot.png");

      selectFile(input, [
        new File(["png-bytes"], "shot.png", { type: "image/png" }),
      ]);

      expect(input.value).toBe("");
    });
  });
});
