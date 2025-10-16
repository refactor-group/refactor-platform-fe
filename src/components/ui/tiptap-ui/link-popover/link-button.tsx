import * as React from "react";
import type { Editor } from "@tiptap/react";

// --- Hooks ---
import { useTiptapEditor } from "@/lib/hooks/use-tiptap-editor";

// --- Icons ---
import { LinkIcon } from "@/components/ui/tiptap-icons/link-icon";

// --- UI Primitives ---
import type { ButtonProps } from "@/components/ui/tiptap-ui-primitive/button";
import { Button } from "@/components/ui/tiptap-ui-primitive/button";

export interface LinkButtonProps extends ButtonProps {
  /**
   * The TipTap editor instance (optional, will use context if not provided).
   */
  editor?: Editor | null;
}

export const LinkButton = React.forwardRef<HTMLButtonElement, LinkButtonProps>(
  ({ className, children, editor: providedEditor, ...props }, ref) => {
    const editor = useTiptapEditor(providedEditor);
    const isActive = editor?.isActive("link") ?? false;

    const handleClick = () => {
      if (!editor) return;

      // Create link with empty href to trigger BubbleMenu
      const { from, to } = editor.state.selection;
      if (from !== to) {
        editor.chain().focus().setLink({ href: "" }).run();
      }
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
