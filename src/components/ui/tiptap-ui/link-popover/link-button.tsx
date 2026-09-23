import * as React from "react";
import { useEditorState, type Editor } from "@tiptap/react";

// --- Hooks ---
import { useTiptapEditor } from "@/lib/hooks/use-tiptap-editor";

// --- Icons ---
import { LinkIcon } from "@/components/ui/tiptap-icons/link-icon";

// --- UI Primitives ---
import type { ButtonProps } from "@/components/ui/tiptap-ui-primitive/button";
import { Button } from "@/components/ui/tiptap-ui-primitive/button";

// --- Utilities ---
import {
  selectionRefusesLink,
  triggerLinkCreation,
} from "@/components/ui/coaching-sessions/coaching-notes/extended-link-extension";

export interface LinkButtonProps extends ButtonProps {
  /**
   * The TipTap editor instance (optional, will use context if not provided).
   */
  editor?: Editor | null;
}

export const LinkButton = React.forwardRef<HTMLButtonElement, LinkButtonProps>(
  ({ className, children, editor: providedEditor, ...props }, ref) => {
    const editor = useTiptapEditor(providedEditor);
    // Tracked reactively: the notes editor does not re-render its toolbar on every
    // transaction, and the answer changes with each new selection.
    const { isActive, refusesLink } = useEditorState({
      editor,
      selector: ({ editor: current }) => ({
        isActive: current?.isActive("link") ?? false,
        refusesLink: current ? selectionRefusesLink(current) : false,
      }),
    }) ?? { isActive: false, refusesLink: false };

    if (!editor || !editor.isEditable) {
      return null;
    }

    const handleClick = () => {
      triggerLinkCreation(editor);
    };

    return (
      <Button
        type="button"
        className={className}
        data-style="ghost"
        role="button"
        tabIndex={-1}
        aria-label="Link"
        tooltip="Link"
        shortcutKeys="Ctrl-k"
        data-active-state={isActive ? "on" : "off"}
        disabled={refusesLink}
        data-disabled={refusesLink}
        ref={ref}
        onClick={handleClick}
        {...props}
      >
        {children || <LinkIcon className="tiptap-button-icon" />}
      </Button>
    );
  }
);

LinkButton.displayName = "LinkButton";
