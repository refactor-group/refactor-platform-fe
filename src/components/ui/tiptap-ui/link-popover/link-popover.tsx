import * as React from "react";
import { isNodeSelection, type Editor } from "@tiptap/react";

// --- Hooks ---
import { useTiptapEditor } from "@/lib/hooks/use-tiptap-editor";
import { useLinkHandler } from "./use-link-handler";
import { useLinkPopoverPositioning } from "./use-link-positioning";

// --- Components ---
import { LinkButton } from "./link-button";
import type { ButtonProps } from "@/components/ui/tiptap-ui-primitive/button";
import { LinkMain } from "./link-main";

// --- UI Primitives ---
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/tiptap-ui-primitive/popover";

// --- Styles ---
import "@/components/ui/tiptap-ui/link-popover/link-popover.scss";

// Re-export components and types
export { LinkButton } from "./link-button";
export type { LinkButtonProps } from "./link-button";

export const LinkContent: React.FC<{
  editor?: Editor | null;
}> = ({ editor: providedEditor }) => {
  const editor = useTiptapEditor(providedEditor);

  const linkHandler = useLinkHandler({
    editor: editor,
  });

  return <LinkMain {...linkHandler} />;
};

export interface LinkPopoverProps extends Omit<ButtonProps, "type"> {
  /**
   * The TipTap editor instance.
   */
  editor?: Editor | null;
  /**
   * Whether to hide the link popover.
   * @default false
   */
  hideWhenUnavailable?: boolean;
  /**
   * Callback for when the popover opens or closes.
   */
  onOpenChange?: (isOpen: boolean) => void;
  /**
   * Whether to automatically open the popover when a link is active.
   * @default true
   */
  autoOpenOnLinkActive?: boolean;
  /**
   * Reference to the editor container for boundary detection.
   */
  containerRef?: React.RefObject<HTMLDivElement>;
}

export function LinkPopover({
  editor: providedEditor,
  hideWhenUnavailable = false,
  onOpenChange,
  autoOpenOnLinkActive = true,
  containerRef,
  ...props
}: LinkPopoverProps) {
  const editor = useTiptapEditor(providedEditor);

  const [isOpen, setIsOpen] = React.useState(false);

  const onSetLink = () => {
    setIsOpen(false);
  };

  const onLinkActive = () => setIsOpen(autoOpenOnLinkActive);

  const onLinkExit = () => setIsOpen(false);

  const linkHandler = useLinkHandler({
    editor: editor,
    onSetLink,
    onLinkActive,
    onLinkExit,
  });

  const isDisabled = React.useMemo(() => {
    if (!editor) return true;
    if (editor.isActive("codeBlock")) return true;
    // Simplified check - allow if we can set marks or have text selected
    return false;
  }, [editor]);

  const canSetLink = React.useMemo(() => {
    if (!editor) return false;
    try {
      return editor.can().setMark("link");
    } catch {
      return false;
    }
  }, [editor]);

  const isActive = editor?.isActive("link") ?? false;

  const handleOnOpenChange = React.useCallback(
    (nextIsOpen: boolean) => {
      setIsOpen(nextIsOpen);
      onOpenChange?.(nextIsOpen);
    },
    [onOpenChange]
  );

  // Get dynamic positioning based on link location
  const { positioning: popoverPositioning } = useLinkPopoverPositioning(
    editor,
    isOpen
  );

  const show = React.useMemo(() => {
    // Temporarily bypass schema check - force show if editor exists
    if (!editor) {
      return false;
    }

    if (hideWhenUnavailable) {
      if (isNodeSelection(editor.state.selection) || !canSetLink) {
        return false;
      }
    }

    return true;
  }, [hideWhenUnavailable, editor, canSetLink]);

  // Create popover props with conditional boundary
  const popoverProps = React.useMemo(() => {
    const baseProps = {
      open: isOpen,
      onOpenChange: handleOnOpenChange,
    };

    // Only add boundary if we have a valid container
    if (containerRef?.current) {
      return {
        ...baseProps,
        boundary: containerRef.current,
        padding: 16,
      };
    }

    return baseProps;
  }, [isOpen, handleOnOpenChange, containerRef]);

  if (!show || !editor || !editor.isEditable) {
    return null;
  }

  return (
    <Popover {...popoverProps}>
      <PopoverTrigger asChild>
        <LinkButton
          disabled={isDisabled}
          data-active-state={isActive ? "on" : "off"}
          data-disabled={isDisabled}
          {...props}
        />
      </PopoverTrigger>

      <PopoverContent
        sideOffset={popoverPositioning.sideOffset}
        alignOffset={0}
        side={popoverPositioning.side}
        align={popoverPositioning.align}
        initialFocus={-1}
      >
        <LinkMain {...linkHandler} />
      </PopoverContent>
    </Popover>
  );
}
