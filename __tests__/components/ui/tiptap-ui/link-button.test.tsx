import { describe, it, expect, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import * as Y from "yjs";
import { Some } from "@/types/option";

vi.mock("@/lib/api/coaching-session-images", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/api/coaching-session-images")
  >();
  return {
    ...actual,
    CoachingSessionImageApi: {
      ...actual.CoachingSessionImageApi,
      markDeleted: vi.fn(),
      restore: vi.fn(),
    },
  };
});

import { Extensions } from "@/components/ui/coaching-sessions/coaching-notes/extensions";
import { COACHING_NOTE_IMAGE_NAME } from "@/components/ui/coaching-sessions/coaching-notes/note-image-extension";
import {
  selectionRefusesLink,
  triggerLinkCreation,
} from "@/components/ui/coaching-sessions/coaching-notes/extended-link-extension";
import { LinkButton } from "@/components/ui/tiptap-ui/link-popover/link-button";
import { TooltipProvider } from "@/components/ui/tooltip";

const IMAGE_ID = "11111111-1111-4111-8111-111111111111";

async function mount(): Promise<{ container: HTMLElement; editor: Editor }> {
  const ref: { current: Editor | null } = { current: null };

  const TestEditor = () => {
    const editor = useEditor({
      extensions: Extensions(new Y.Doc(), null, undefined, Some({
        coachingSessionId: "session-1",
        maxBytes: 10 * 1024 * 1024,
      })),
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "some words" }] },
          { type: COACHING_NOTE_IMAGE_NAME, attrs: { imageId: IMAGE_ID } },
        ],
      },
      immediatelyRender: false,
    });
    ref.current = editor;
    return editor ? (
      <>
        <LinkButton editor={editor} />
        <EditorContent editor={editor} />
      </>
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

function imagePos(editor: Editor): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === COACHING_NOTE_IMAGE_NAME) found = pos;
  });
  return found;
}

function linkButton(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('button[aria-label="Link"]') as HTMLButtonElement;
}

// A link is a mark and attaches only to inline content, so a selected image cannot
// take one. The button used to stay live and do nothing at all when clicked.
describe("Link with an image selected", () => {
  it("disables the Link button", async () => {
    const { container, editor } = await mount();

    act(() => {
      editor.commands.setNodeSelection(imagePos(editor));
    });

    await waitFor(() => expect(linkButton(container).disabled).toBe(true));
  });

  it("enables it again once text is selected", async () => {
    const { container, editor } = await mount();
    act(() => {
      editor.commands.setNodeSelection(imagePos(editor));
    });
    await waitFor(() => expect(linkButton(container).disabled).toBe(true));

    act(() => {
      editor.commands.setTextSelection({ from: 1, to: 5 });
    });

    await waitFor(() => expect(linkButton(container).disabled).toBe(false));
  });

  // Out of scope for this change: an empty cursor behaves exactly as before.
  it("leaves the button enabled for an empty cursor", async () => {
    const { container, editor } = await mount();

    act(() => {
      editor.commands.setTextSelection(2);
    });

    await waitFor(() => expect(linkButton(container).disabled).toBe(false));
  });

  // Cmd-K goes through the same trigger, and must not claim it handled anything.
  it("makes the shortcut decline rather than silently do nothing", async () => {
    const { editor } = await mount();
    act(() => {
      editor.commands.setNodeSelection(imagePos(editor));
    });
    const before = JSON.stringify(editor.getJSON());

    expect(selectionRefusesLink(editor)).toBe(true);
    let handled = true;
    act(() => {
      handled = triggerLinkCreation(editor);
    });

    expect(handled).toBe(false);
    expect(JSON.stringify(editor.getJSON())).toBe(before);
  });

  it("still starts a link for selected text", async () => {
    const { editor } = await mount();
    act(() => {
      editor.commands.setTextSelection({ from: 1, to: 5 });
    });

    expect(selectionRefusesLink(editor)).toBe(false);
    act(() => {
      triggerLinkCreation(editor);
    });

    expect(editor.isActive("link")).toBe(true);
  });
});
