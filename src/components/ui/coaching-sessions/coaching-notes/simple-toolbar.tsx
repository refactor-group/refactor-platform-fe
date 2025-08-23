import React from "react";
import { useCurrentEditor, useEditorState } from "@tiptap/react";

// --- TipTap UI Primitives ---
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
  Spacer,
} from "@/components/ui/tiptap-ui-primitive";

// --- TipTap UI Components ---
import {
  MarkButton,
  UndoRedoButton,
  HeadingDropdownMenu,
  ListDropdownMenu,
  BlockquoteButton,
  CodeBlockButton,
  LinkPopover,
} from "@/components/ui/tiptap-ui";

interface SimpleToolbarProps {
  /**
   * Reference to the editor container for proper popover positioning.
   */
  containerRef?: React.RefObject<HTMLElement | null>;
}

export const SimpleToolbar: React.FC<SimpleToolbarProps> = ({ containerRef }) => {
  const { editor } = useCurrentEditor();

  // Use TipTap's official pattern for undo/redo state tracking
  const editorState = useEditorState({
    editor,
    selector: ctx => {
      if (!ctx.editor) return { canUndo: false, canRedo: false };
      return {
        canUndo: ctx.editor.can().chain().focus().undo().run(),
        canRedo: ctx.editor.can().chain().focus().redo().run(),
      };
    },
  });

  const canUndo = editorState?.canUndo ?? false;
  const canRedo = editorState?.canRedo ?? false;

  if (!editor) {
    return null;
  }

  return (
    <Toolbar>
      <ToolbarGroup>
        <UndoRedoButton 
          action="undo" 
          disabled={!canUndo}
        />
        <UndoRedoButton 
          action="redo" 
          disabled={!canRedo}
        />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu levels={[1, 2, 3]} />
        <ListDropdownMenu types={["bulletList", "orderedList", "taskList"]} />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        <LinkPopover hideWhenUnavailable={false} containerRef={containerRef} />
      </ToolbarGroup>

      <Spacer />
    </Toolbar>
  );
};