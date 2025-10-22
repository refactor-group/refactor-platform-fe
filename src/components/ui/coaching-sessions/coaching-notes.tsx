"use client";

import { EditorProvider } from "@tiptap/react";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { SimpleToolbar } from "@/components/ui/coaching-sessions/coaching-notes/simple-toolbar";
import { FloatingToolbar } from "@/components/ui/coaching-sessions/coaching-notes/floating-toolbar";
import { LinkBubbleMenu } from "@/components/ui/tiptap-ui/link-bubble-menu";
import { useEditorCache } from "@/components/ui/coaching-sessions/editor-cache-context";
import type { Extensions } from "@tiptap/core";
import * as Y from "yjs";
import { toast } from "sonner";
import "@/styles/simple-editor.scss";
import "@/styles/tiptap-table.scss";

/** Maximum loading progress percentage before completion (allows room for final jump to 100%) */
const LOADING_PROGRESS_MAX = 90;

/** Maximum random increment for loading progress animation */
const LOADING_PROGRESS_INCREMENT_MAX = 15;

/** Interval in milliseconds for updating loading progress animation */
const LOADING_PROGRESS_INTERVAL_MS = 150;

/** Height of the application header in pixels (used for floating toolbar positioning) */
const HEADER_HEIGHT_PX = 64;

// Main component: orchestrates editor state and rendering logic

const CoachingNotes = () => {
  const { yDoc, extensions, isReady, isLoading, error } = useEditorCache();
  const activeExtensions = useMemo(
    () => (isReady && extensions.length > 0 ? extensions : []),
    [isReady, extensions]
  );
  const loadingProgress = useLoadingProgress(isLoading);
  const renderState = determineRenderState({
    isReady,
    isLoading,
    error,
    extensions: activeExtensions,
  });

  return renderEditorByState(
    renderState,
    { yDoc, extensions: activeExtensions, isReady, isLoading, error },
    loadingProgress
  );
};

const useLoadingProgress = (isLoading: boolean) => {
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    if (isLoading) {
      return startProgressAnimation(setLoadingProgress);
    } else {
      completeProgress(setLoadingProgress);
    }
  }, [isLoading]);

  return loadingProgress;
};

const determineRenderState = (editorState: {
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
  extensions: Extensions;
}) => {
  if (editorState.isLoading) return "loading";
  if (editorState.error) return "error";
  if (editorState.isReady && editorState.extensions.length > 0) return "ready";
  return "fallback";
};

const renderEditorByState = (
  renderState: string,
  editorState: {
    yDoc: Y.Doc | null;
    extensions: Extensions;
    isReady: boolean;
    isLoading: boolean;
    error: Error | null;
  },
  loadingProgress: number
) => {
  switch (renderState) {
    case "loading":
      return renderLoadingState(loadingProgress);
    case "error":
      return renderErrorState(editorState.error);
    case "ready":
      return renderReadyEditor(editorState.extensions);
    default:
      return renderFallbackState();
  }
};

// Utility functions

const startProgressAnimation = (
  setLoadingProgress: React.Dispatch<React.SetStateAction<number>>
) => {
  setLoadingProgress(0);
  const interval = setInterval(() => {
    setLoadingProgress((prev) => {
      if (prev >= LOADING_PROGRESS_MAX) {
        clearInterval(interval);
        return LOADING_PROGRESS_MAX;
      }
      return prev + Math.random() * LOADING_PROGRESS_INCREMENT_MAX;
    });
  }, LOADING_PROGRESS_INTERVAL_MS);
  return () => clearInterval(interval);
};

const completeProgress = (
  setLoadingProgress: React.Dispatch<React.SetStateAction<number>>
) => {
  setLoadingProgress(100);
};

const renderLoadingState = (loadingProgress: number) => (
  <div className="coaching-notes-editor">
    <div className="coaching-notes-loading">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Loading coaching notes...</span>
          <span className="text-sm opacity-70">
            {Math.round(loadingProgress)}%
          </span>
        </div>
        <Progress value={loadingProgress} className="h-2" />
      </div>
    </div>
  </div>
);

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

const renderReadyEditor = (extensions: Extensions) => {
  try {
    return <CoachingNotesWithFloatingToolbar extensions={extensions} />;
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

const renderFallbackState = () => (
  <div className="coaching-notes-editor">
    <div className="coaching-notes-loading">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Loading coaching notes...</span>
          <span className="text-sm opacity-70">{LOADING_PROGRESS_MAX}%</span>
        </div>
        <Progress value={LOADING_PROGRESS_MAX} className="h-2" />
      </div>
    </div>
  </div>
);

// Editor with floating toolbar: main editing interface

const CoachingNotesWithFloatingToolbar: React.FC<{
  extensions: Extensions;
}> = ({ extensions }) => {
  const { editorRef, toolbarRef, toolbarState, handlers } =
    useToolbarManagement();
  const editorProps = buildEditorProps();
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

const buildEditorProps = () => ({
  attributes: {
    class: "tiptap ProseMirror",
    spellcheck: "true",
  },
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
