import { useState, useCallback, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu, type BubbleMenuProps } from "@tiptap/react/menus";
import { Copy, ListPlus, X } from "lucide-react";
import { toast } from "sonner";

import { useTiptapEditor } from "@/lib/hooks/use-tiptap-editor";
import { Button } from "@/components/ui/tiptap-ui-primitive/button";
import { Separator } from "@/components/ui/tiptap-ui-primitive/separator";

import "@/components/ui/tiptap-ui/selection-bubble-menu/selection-bubble-menu.scss";

/** Vertical offset in pixels between the bubble menu and the selected text */
const BUBBLE_MENU_OFFSET_PX = 8;

/** Delay in milliseconds before the bubble menu updates its position */
const BUBBLE_MENU_UPDATE_DELAY_MS = 100;

// ---------------------------------------------------------------------------
// shouldShow predicate — exported for testing
// ---------------------------------------------------------------------------

interface ShouldShowParams {
  editor: Pick<Editor, "isActive" | "state">;
  from: number;
  to: number;
}

/**
 * Determines whether the selection bubble menu should be visible.
 *
 * Rules:
 * - Selection must be non-empty (from !== to)
 * - Selection must NOT be inside a link (LinkBubbleMenu handles that)
 * - Selection must NOT be inside a code block
 * - Selected text must contain non-whitespace characters
 */
export function shouldShowSelectionMenu({
  editor,
  from,
  to,
}: ShouldShowParams): boolean {
  if (from === to) return false;
  if (editor.isActive("link")) return false;
  if (editor.isActive("codeBlock")) return false;

  const text = editor.state.doc.textBetween(from, to, " ");
  if (text.trim().length === 0) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface SelectionBubbleMenuProps {
  editor?: Editor | null;
  onAddAsAction: (selectedText: string) => void;
}

export function SelectionBubbleMenu({
  editor: providedEditor,
  onAddAsAction,
}: SelectionBubbleMenuProps) {
  const editor = useTiptapEditor(providedEditor);
  const [dismissed, setDismissed] = useState(false);
  const [selectingText, setSelectingText] = useState(false);

  // Callback ref to set z-index on the BubbleMenu's outer positioning
  // element so it renders above the editor toolbar.
  const menuRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      el.style.zIndex = "50";
    }
  }, []);

  // Hide the menu while the user is actively dragging a selection in the editor.
  // We listen for mousedown on the editor element specifically (not the document)
  // so that clicks on the bubble menu buttons themselves don't trigger hiding.
  // mousedown also dismisses the menu so clicking outside hides it immediately.
  // mouseup (on the document, since the user may release outside the editor)
  // clears `selectingText`; the menu only reappears when a subsequent
  // `selectionUpdate` fires with a non-empty selection, resetting `dismissed`.
  //
  // Rather than suppressing in `shouldShow` (which TipTap's BubbleMenu plugin
  // only re-evaluates on editor transactions), we let the BubbleMenu remain
  // "shown" and hide the content with CSS.
  useEffect(() => {
    if (!editor) return;

    const editorEl = editor.view.dom;
    const handleMouseDown = () => {
      setSelectingText(true);
      setDismissed(true);
    };
    const handleMouseUp = () => setSelectingText(false);

    editorEl.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      editorEl.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [editor]);

  // Reset dismissed state when the user makes a new non-empty selection.
  // We guard on from !== to so that a collapsing selection (e.g. after
  // clicking a bubble menu button) doesn't briefly un-dismiss the menu.
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        setDismissed(false);
      }
    };

    editor.on("selectionUpdate", handleSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor]);

  const getSelectedText = useCallback((): string => {
    if (!editor) return "";
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, " ");
  }, [editor]);

  const handleCopy = useCallback(async () => {
    const text = getSelectedText().trim();
    if (!text) return;

    setDismissed(true);
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard");
    } catch {
      toast.error("Failed to copy text");
    }
  }, [getSelectedText]);

  const handleAddAsAction = useCallback(() => {
    const text = getSelectedText().trim();
    if (!text) return;
    setDismissed(true);
    onAddAsAction(text);
  }, [getSelectedText, onAddAsAction]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!editor) {
    return null;
  }

  const shouldShow: NonNullable<BubbleMenuProps["shouldShow"]> = ({
    editor: bubbleEditor,
    from,
    to,
  }) => {
    return shouldShowSelectionMenu({ editor: bubbleEditor, from, to });
  };

  const bubbleMenuOptions = {
    placement: "top",
    offset: BUBBLE_MENU_OFFSET_PX,
    flip: true,
    shift: true,
  } as const;

  return (
    <BubbleMenu
      ref={menuRef}
      editor={editor}
      shouldShow={shouldShow}
      updateDelay={BUBBLE_MENU_UPDATE_DELAY_MS}
      options={bubbleMenuOptions}
    >
      <div
        className="selection-bubble-menu"
        style={selectingText || dismissed ? { visibility: "hidden" } : undefined}
      >
        <Button
          type="button"
          onClick={handleCopy}
          tooltip="Copy"
          data-style="ghost"
          aria-label="Copy selected text"
        >
          <Copy className="tiptap-button-icon" />
        </Button>

        <Separator orientation="vertical" />

        <Button
          type="button"
          onClick={handleAddAsAction}
          tooltip="Add as Action"
          data-style="ghost"
          aria-label="Add as Action"
        >
          <ListPlus className="tiptap-button-icon" />
        </Button>

        <Separator orientation="vertical" />

        <Button
          type="button"
          onClick={handleDismiss}
          tooltip="Close"
          data-style="ghost"
          aria-label="Close"
        >
          <X className="tiptap-button-icon" />
        </Button>
      </div>
    </BubbleMenu>
  );
}
