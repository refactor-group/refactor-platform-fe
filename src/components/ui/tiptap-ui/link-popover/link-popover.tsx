import * as React from "react";
import { isNodeSelection, type Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";

// --- Hooks ---
import { useTiptapEditor } from "@/lib/hooks/use-tiptap-editor";

// --- Icons ---
import { CornerDownLeftIcon } from "@/components/ui/tiptap-icons/corner-down-left-icon";
import { ExternalLinkIcon } from "@/components/ui/tiptap-icons/external-link-icon";
import { LinkIcon } from "@/components/ui/tiptap-icons/link-icon";
import { TrashIcon } from "@/components/ui/tiptap-icons/trash-icon";

// --- Lib ---
import { sanitizeUrl } from "@/lib/tiptap-utils";

// --- UI Primitives ---
import type { ButtonProps } from "@/components/ui/tiptap-ui-primitive/button";
import { Button } from "@/components/ui/tiptap-ui-primitive/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverBoundary,
  PopoverRootBoundary,
} from "@/components/ui/tiptap-ui-primitive/popover";
import { Separator } from "@/components/ui/tiptap-ui-primitive/separator";

// --- Styles ---
import "@/components/ui/tiptap-ui/link-popover/link-popover.scss";

export interface LinkHandlerProps {
  editor: Editor | null;
  onSetLink?: () => void;
  onLinkActive?: () => void;
  onLinkExit?: () => void;
}

export interface LinkMainProps {
  url: string;
  setUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setLink: () => void;
  removeLink: () => void;
  isActive: boolean;
}

/**
 * Get the DOM bounding rectangle of the active link in the editor.
 * Uses TipTap's view API to map document positions to DOM coordinates.
 * @returns DOMRect of the link element, or null if no link is active
 */
const getLinkPositionInEditor = (editor: Editor): DOMRect | null => {
  if (!editor.isActive("link")) return null;

  const { state, view } = editor;
  const { from, to } = state.selection;

  // Get the DOM node at the selection position
  const domAtPos = view.domAtPos(from);
  const node = domAtPos.node;

  // Find the actual link element
  let linkElement: HTMLElement | null = null;
  if (node instanceof HTMLElement) {
    linkElement = node.closest("a");
  } else if (node.parentElement) {
    linkElement = node.parentElement.closest("a");
  }

  if (linkElement) {
    return linkElement.getBoundingClientRect();
  }

  // Fallback to coordsAtPos if we can't find the DOM element
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);

  return new DOMRect(
    start.left,
    start.top,
    end.right - start.left,
    end.bottom - start.top
  );
};

interface LinkPopoverPositioning {
  positioning: {
    side: "bottom";
    align: "start";
    sideOffset: number;
    useVirtualElement: boolean;
  };
  virtualElement: {
    getBoundingClientRect: () => DOMRect;
  } | null;
}

/**
 * Hook to determine dynamic popover positioning based on link location.
 * Returns both positioning config and optional virtual element for FloatingUI.
 * @param editor - TipTap editor instance
 * @param isOpen - Whether the popover is currently open
 * @returns Positioning configuration and virtual element reference
 */
const useLinkPopoverPositioning = (
  editor: Editor | null,
  isOpen: boolean
): LinkPopoverPositioning => {
  const linkPosition = React.useMemo(() => {
    if (!editor || !editor.isActive("link") || !isOpen) return null;
    return getLinkPositionInEditor(editor);
  }, [editor, isOpen, editor?.state.selection]);

  // Create a virtual element for FloatingUI to position relative to the link
  const virtualElement = React.useMemo(() => {
    if (!linkPosition) return null;

    return {
      getBoundingClientRect: () => linkPosition,
    };
  }, [linkPosition]);

  const positioning = React.useMemo(() => {
    if (linkPosition) {
      // Editing existing link - position near the link with smaller offset
      return {
        side: "bottom" as const,
        align: "start" as const,
        sideOffset: 4,
        useVirtualElement: true,
      };
    }
    // Creating new link - position under toolbar button with standard offset
    return {
      side: "bottom" as const,
      align: "start" as const,
      sideOffset: 8,
      useVirtualElement: false,
    };
  }, [linkPosition]);

  return { positioning, virtualElement };
};

/**
 * Check if cursor is inside or touching link content.
 * Implements modified Google Docs behavior:
 * - Cursor just to the left of link (touching) triggers popover
 * - Cursor inside link content triggers popover
 * - Cursor just to the right of link (touching) triggers popover
 */
const isCursorInsideLink = (editor: Editor): boolean => {
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

export const LinkContent: React.FC<{
  editor?: Editor | null;
}> = ({ editor: providedEditor }) => {
  const editor = useTiptapEditor(providedEditor);

  const linkHandler = useLinkHandler({
    editor: editor,
  });

  return <LinkMain {...linkHandler} />;
};

const LinkMain: React.FC<LinkMainProps> = ({
  url,
  setUrl,
  setLink,
  removeLink,
  isActive,
}) => {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setLink();
    }
  };

  const handleOpenLink = () => {
    if (!url) return;

    const safeUrl = sanitizeUrl(url, window.location.href);
    if (safeUrl !== "#") {
      window.open(safeUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
      <input
        type="url"
        placeholder="Paste a link..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        className="tiptap-input tiptap-input-clamp"
      />

      <div className="tiptap-button-group" data-orientation="horizontal">
        <Button
          type="button"
          onClick={setLink}
          title="Apply link"
          disabled={!url && !isActive}
          data-style="ghost"
        >
          <CornerDownLeftIcon className="tiptap-button-icon" />
        </Button>
      </div>

      <Separator />

      <div className="tiptap-button-group" data-orientation="horizontal">
        <Button
          type="button"
          onClick={handleOpenLink}
          title="Open in new window"
          disabled={!url && !isActive}
          data-style="ghost"
        >
          <ExternalLinkIcon className="tiptap-button-icon" />
        </Button>

        <Button
          type="button"
          onClick={removeLink}
          title="Remove link"
          disabled={!url && !isActive}
          data-style="ghost"
        >
          <TrashIcon className="tiptap-button-icon" />
        </Button>
      </div>
    </>
  );
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

LinkButton.displayName = "LinkButton";
