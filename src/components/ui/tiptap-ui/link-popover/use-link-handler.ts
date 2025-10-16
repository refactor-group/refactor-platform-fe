import * as React from "react";
import type { Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";

export interface LinkHandlerProps {
  editor: Editor | null;
  onSetLink?: () => void;
  onLinkActive?: () => void;
  onLinkExit?: () => void;
}

/**
 * Check if cursor is inside or touching link content.
 * Implements modified Google Docs behavior:
 * - Cursor just to the left of link (touching) triggers popover
 * - Cursor inside link content triggers popover
 * - Cursor just to the right of link (touching) triggers popover
 */
export const isCursorInsideLink = (editor: Editor): boolean => {
  const { state } = editor;
  const { from, to, $from } = state.selection;

  // For range selections with link active, consider it "inside"
  if (from !== to && editor.isActive("link")) return true;

  // For collapsed selection (cursor)
  const linkMark = state.schema.marks.link;
  const resolvedPos = $from;

  // Get marks at current position
  const marksHere = resolvedPos.marks();
  const linkMarkHere = marksHere.find((m) => m.type === linkMark);

  // Check positions before and after cursor
  const beforePos = Math.max(0, from - 1);
  const afterPos = Math.min(state.doc.content.size, from + 1);

  const marksBefore =
    beforePos >= 0 ? state.doc.resolve(beforePos).marks() : [];
  const marksAfter =
    afterPos <= state.doc.content.size
      ? state.doc.resolve(afterPos).marks()
      : [];

  // If cursor position doesn't have link mark, check if we're touching a link
  if (!linkMarkHere) {
    // Allow trigger if cursor is just to the left of a link (touching it)
    const hasLinkAfter = marksAfter.some((m) => m.type === linkMark);
    return hasLinkAfter;
  }

  // At this point, cursor has a link mark
  const hasLinkBefore = marksBefore.some(
    (m) => m.type === linkMark && m.attrs.href === linkMarkHere.attrs.href
  );
  const hasLinkAfter = marksAfter.some(
    (m) => m.type === linkMark && m.attrs.href === linkMarkHere.attrs.href
  );

  // We're inside if we have link on both sides (middle of link)
  // OR if we have link on exactly one side (start or end position after first/last char)
  return hasLinkBefore || hasLinkAfter;
};

export const useLinkHandler = (props: LinkHandlerProps) => {
  const { editor, onSetLink, onLinkActive, onLinkExit } = props;
  const [url, setUrl] = React.useState<string | null>(null);
  const wasInsideLink = React.useRef(false);

  React.useEffect(() => {
    if (!editor) return;

    const handleTransaction = ({
      transaction,
    }: {
      transaction: Transaction;
    }) => {
      // Update URL state when on or touching a link
      if (editor.isActive("link")) {
        const { href } = editor.getAttributes("link");
        setUrl(href || "");
      } else {
        // Check if we're touching a link (cursor just to the left)
        const { state } = editor;
        const { from, $from } = state.selection;
        const afterPos = Math.min(state.doc.content.size, from + 1);
        const marksAfter =
          afterPos <= state.doc.content.size
            ? state.doc.resolve(afterPos).marks()
            : [];
        const linkMarkAfter = marksAfter.find(
          (m) => m.type === state.schema.marks.link
        );

        if (linkMarkAfter) {
          setUrl(linkMarkAfter.attrs.href || "");
        }
      }

      // Check if cursor just entered or exited the link
      const isInsideNow = isCursorInsideLink(editor);

      if (isInsideNow && !wasInsideLink.current) {
        // Just entered link - open popover
        onLinkActive?.();
      } else if (!isInsideNow && wasInsideLink.current) {
        // Just exited link - close popover
        onLinkExit?.();
      }

      wasInsideLink.current = isInsideNow;
    };

    editor.on("transaction", handleTransaction);
    return () => {
      editor.off("transaction", handleTransaction);
    };
  }, [editor, onLinkActive, onLinkExit]);

  const setLink = React.useCallback(() => {
    if (!url || !editor) return;

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();

    setUrl(null);

    onSetLink?.();
  }, [editor, onSetLink, url]);

  const removeLink = React.useCallback(() => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .unsetLink()
      .setMeta("preventAutolink", true)
      .run();
    setUrl("");
  }, [editor]);

  return {
    url: url || "",
    setUrl,
    setLink,
    removeLink,
    isActive: editor?.isActive("link") || false,
  };
};
