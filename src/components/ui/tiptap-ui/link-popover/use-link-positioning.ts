import * as React from "react";
import type { Editor } from "@tiptap/react";

export interface LinkPopoverPositioning {
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
 * Get the DOM bounding rectangle of the active link in the editor.
 * Uses TipTap's view API to map document positions to DOM coordinates.
 * @returns DOMRect of the link element, or null if no link is active
 */
export const getLinkPositionInEditor = (editor: Editor): DOMRect | null => {
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

/**
 * Hook to determine dynamic popover positioning based on link location.
 * Returns both positioning config and optional virtual element for FloatingUI.
 * @param editor - TipTap editor instance
 * @param isOpen - Whether the popover is currently open
 * @returns Positioning configuration and virtual element reference
 */
export const useLinkPopoverPositioning = (
  editor: Editor | null,
  isOpen: boolean
): LinkPopoverPositioning => {
  // Track selection version to trigger recalculation without direct dependency
  const [selectionVersion, setSelectionVersion] = React.useState(0);

  React.useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      setSelectionVersion(v => v + 1);
    };

    editor.on("selectionUpdate", handleSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor]);

  return React.useMemo(() => {
    const linkPosition = (!editor || !editor.isActive("link") || !isOpen)
      ? null
      : getLinkPositionInEditor(editor);

    const virtualElement = linkPosition ? {
      getBoundingClientRect: () => linkPosition,
    } : null;

    const positioning = linkPosition ? {
      // Editing existing link - position near the link with smaller offset
      side: "bottom" as const,
      align: "start" as const,
      sideOffset: 4,
      useVirtualElement: true,
    } : {
      // Creating new link - position under toolbar button with standard offset
      side: "bottom" as const,
      align: "start" as const,
      sideOffset: 8,
      useVirtualElement: false,
    };

    return { positioning, virtualElement };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectionVersion is intentionally used to trigger recalculation when selection changes
  }, [editor, isOpen, selectionVersion]);
};
