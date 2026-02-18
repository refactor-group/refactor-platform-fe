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

  // Reset dismissed state when selection changes
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      setDismissed(false);
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
    if (dismissed) return false;
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
      editor={editor}
      shouldShow={shouldShow}
      updateDelay={BUBBLE_MENU_UPDATE_DELAY_MS}
      options={bubbleMenuOptions}
    >
      <div className="selection-bubble-menu">
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
