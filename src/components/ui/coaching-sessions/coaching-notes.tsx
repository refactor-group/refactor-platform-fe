"use client";

import { EditorProvider } from "@tiptap/react";
import { useRef, useState, useMemo, useCallback } from "react";
import { SimpleToolbar } from "@/components/ui/coaching-sessions/coaching-notes/simple-toolbar";
import { FloatingToolbar } from "@/components/ui/coaching-sessions/coaching-notes/floating-toolbar";
import { LinkBubbleMenu } from "@/components/ui/tiptap-ui/link-bubble-menu";
import { useEditorCache } from "@/components/ui/coaching-sessions/editor-cache-context";
import type { Extensions } from "@tiptap/core";
import * as Y from "yjs";
import { toast } from "sonner";
import "@/styles/simple-editor.scss";
import "@/styles/tiptap-table.scss";

/** Height of the application header in pixels (used for floating toolbar positioning) */
const HEADER_HEIGHT_PX = 64;

// Main component: orchestrates editor state and rendering logic

const CoachingNotes = () => {
  const { extensions, isReady, error } = useEditorCache();

  // Show error state if there's an error
  if (error) {
    return renderErrorState(error);
  }

  // Wait for extensions to be populated before rendering editor
  // (TipTap requires at least the Document extension to create a valid schema)
  if (extensions.length === 0) {
    return null; // Render nothing while extensions are loading
  }

  // Render the editor (will be read-only until isReady = true)
  return renderReadyEditor(extensions, isReady);
};

const renderErrorState = (error: Error | null) => (
  <div className="coaching-notes-editor">
    <div className="coaching-notes-error">
      <div className="text-center">
        <p className="mb-2">⚠️ Could not load coaching notes</p>
        <p className="text-sm opacity-80">
          {error?.message ||
            "Please try again later or contact support if the issue persists."}
        </p>
      </div>
    </div>
  </div>
);

const renderReadyEditor = (extensions: Extensions, isReady: boolean) => {
  try {
    return <CoachingNotesWithFloatingToolbar extensions={extensions} isReady={isReady} />;
  } catch (error) {
    console.error("Editor initialization failed:", error);
    return (
      <div className="coaching-notes-editor">
        <div className="coaching-notes-error">
          <div className="text-center">
            <p className="mb-2">❌ Failed to initialize editor</p>
            <p className="text-sm opacity-80">
              Error: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </div>
      </div>
    );
  }
};

// Editor with floating toolbar: main editing interface

const CoachingNotesWithFloatingToolbar: React.FC<{
  extensions: Extensions;
  isReady: boolean;
}> = ({ extensions, isReady }) => {
  const { editorRef, toolbarRef, toolbarState, handlers } =
    useToolbarManagement();
  const editorProps = buildEditorProps(isReady);
  const toolbarSlots = buildToolbarSlots(
    editorRef,
    toolbarRef,
    toolbarState,
    handlers
  );

  return renderEditorWithToolbars(
    editorRef,
    extensions,
    editorProps,
    toolbarSlots
  );
};

// Toolbar state management

const useToolbarManagement = () => {
  const editorRef = useRef<HTMLDivElement>(null!);
  const toolbarRef = useRef<HTMLDivElement>(null!);
  const [originalToolbarVisible, setOriginalToolbarVisible] = useState(true);

  const handleOriginalToolbarVisibilityChange = useCallback(
    (visible: boolean) => {
      setOriginalToolbarVisible(visible);
    },
    []
  );

  return {
    editorRef,
    toolbarRef,
    toolbarState: { originalToolbarVisible },
    handlers: { handleOriginalToolbarVisibilityChange },
  };
};

const buildEditorProps = (isReady: boolean) => ({
  attributes: {
    class: "tiptap ProseMirror",
    spellcheck: "true",
  },
  editable: () => isReady,
  handleDOMEvents: {
    click: createLinkClickHandler(),
  },
});

const buildToolbarSlots = (
  editorRef: React.RefObject<HTMLDivElement>,
  toolbarRef: React.RefObject<HTMLDivElement>,
  toolbarState: { originalToolbarVisible: boolean },
  handlers: {
    handleOriginalToolbarVisibilityChange: (visible: boolean) => void;
  }
) => ({
  slotBefore: (
    <div
      ref={toolbarRef}
      className={`toolbar-container ${
        toolbarState.originalToolbarVisible ? "visible" : "hidden"
      }`}
    >
      <SimpleToolbar />
    </div>
  ),
  slotAfter: (
    <FloatingToolbar
      editorRef={editorRef}
      toolbarRef={toolbarRef}
      headerHeight={HEADER_HEIGHT_PX}
      onOriginalToolbarVisibilityChange={
        handlers.handleOriginalToolbarVisibilityChange
      }
    />
  ),
});

const renderEditorWithToolbars = (
  editorRef: React.RefObject<HTMLDivElement>,
  extensions: Extensions,
  editorProps: ReturnType<typeof buildEditorProps>,
  toolbarSlots: ReturnType<typeof buildToolbarSlots>
) => (
  <div ref={editorRef} className="coaching-notes-editor">
    <EditorProvider
      extensions={extensions}
      autofocus={false}
      immediatelyRender={false}
      shouldRerenderOnTransaction={false}
      onContentError={handleEditorContentError}
      editorProps={editorProps}
      slotBefore={toolbarSlots.slotBefore}
      slotAfter={toolbarSlots.slotAfter}
    >
      <LinkBubbleMenu />
    </EditorProvider>
  </div>
);

// Event handling utilities

const createLinkClickHandler = () => (_view: unknown, event: Event) => {
  const target = event.target as HTMLElement;
  const mouseEvent = event as MouseEvent;

  if (isShiftClickOnLink(target, mouseEvent)) {
    event.preventDefault();
    openLinkInNewTab(target);
    return true;
  }
  return false;
};

const isShiftClickOnLink = (
  target: HTMLElement,
  event: MouseEvent
): boolean => {
  return !!(
    (target.tagName === "A" || target.parentElement?.tagName === "A") &&
    event.shiftKey
  );
};

const openLinkInNewTab = (target: HTMLElement) => {
  const href =
    target.getAttribute("href") || target.parentElement?.getAttribute("href");
  if (href) {
    window.open(href, "_blank")?.focus();
  }
};

const handleEditorContentError = (error: unknown) => {
  console.error("Editor content error:", error);

  // Show user-friendly error message via toast
  toast.error("An error occurred while editing. Please try again.");
};

export { CoachingNotes };
