"use client";

import { EditorProvider, useEditor, EditorContent } from "@tiptap/react";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { SimpleToolbar } from "@/components/ui/coaching-sessions/coaching-notes/simple-toolbar";
import { FloatingToolbar } from "@/components/ui/coaching-sessions/coaching-notes/floating-toolbar";
import { useEditorCache } from "@/components/ui/coaching-sessions/editor-cache-context";
import type { Extensions } from "@tiptap/core";
import "@/styles/simple-editor.scss";

// ============================================================================
// TOP LEVEL: Story-driven main component
// ============================================================================

const CoachingNotes = () => {
  const editorState = useEditorState();
  const loadingProgress = useLoadingProgress(editorState.isLoading);
  const renderState = determineRenderState(editorState);
  
  return renderEditorByState(renderState, editorState, loadingProgress);
};

// ============================================================================
// MIDDLE LEVEL: Logical operation functions
// ============================================================================

const useEditorState = () => {
  const { yDoc, extensions, isReady, isLoading, error } = useEditorCache();
  const activeExtensions = useMemo((): Extensions => {
    return selectActiveExtensions(isReady, extensions);
  }, [isReady, extensions]);
  
  return {
    yDoc,
    extensions: activeExtensions,
    isReady,
    isLoading,
    error
  };
};

const useLoadingProgress = (isLoading: boolean) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  useEffect(() => {
    if (isLoading) {
      startProgressAnimation(setLoadingProgress);
    } else {
      completeProgress(setLoadingProgress);
    }
  }, [isLoading]);
  
  return loadingProgress;
};

const determineRenderState = (editorState: ReturnType<typeof useEditorState>) => {
  if (editorState.isLoading) return 'loading';
  if (editorState.error) return 'error';
  if (editorState.isReady && editorState.extensions.length > 0) return 'ready';
  return 'fallback';
};

const renderEditorByState = (
  renderState: string,
  editorState: ReturnType<typeof useEditorState>,
  loadingProgress: number
) => {
  switch (renderState) {
    case 'loading':
      return renderLoadingState(loadingProgress);
    case 'error':
      return renderErrorState(editorState.error);
    case 'ready':
      return renderReadyEditor(editorState.extensions);
    default:
      return renderFallbackState();
  }
};

// ============================================================================
// LOW LEVEL: Specific implementation details
// ============================================================================

const selectActiveExtensions = (isReady: boolean, extensions: Extensions): Extensions => {
  if (isReady && extensions.length > 0) {
    if (process.env.NODE_ENV === "development") {
      console.log("🔧 Using cached extensions:", extensions.length);
    }
    return extensions;
  }
  return [];
};

const startProgressAnimation = (setLoadingProgress: React.Dispatch<React.SetStateAction<number>>) => {
  setLoadingProgress(0);
  const interval = setInterval(() => {
    setLoadingProgress((prev) => {
      if (prev >= 90) {
        clearInterval(interval);
        return 90;
      }
      return prev + Math.random() * 15;
    });
  }, 150);
  return () => clearInterval(interval);
};

const completeProgress = (setLoadingProgress: React.Dispatch<React.SetStateAction<number>>) => {
  setLoadingProgress(100);
};

const renderLoadingState = (loadingProgress: number) => (
  <div className="coaching-notes-editor">
    <div className="coaching-notes-loading">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Loading coaching notes...
          </span>
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
    console.error("❌ Error rendering cached editor:", error);
    return (
      <div className="coaching-notes-editor">
        <div className="coaching-notes-error">
          <div className="text-center">
            <p className="mb-2">❌ Failed to initialize editor</p>
            <p className="text-sm opacity-80">
              Error:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
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
          <span className="text-sm font-medium">
            Loading coaching notes...
          </span>
          <span className="text-sm opacity-70">90%</span>
        </div>
        <Progress value={90} className="h-2" />
      </div>
    </div>
  </div>
);

// ============================================================================
// FLOATING TOOLBAR COMPONENT: Composed editor with toolbar management
// ============================================================================

const CoachingNotesWithFloatingToolbar: React.FC<{
  extensions: Extensions;
}> = ({ extensions }) => {
  const { editorRef, toolbarRef, toolbarState, handlers } = useToolbarManagement();
  const editorProps = buildEditorProps();
  const toolbarSlots = buildToolbarSlots(editorRef, toolbarRef, toolbarState, handlers);
  
  return renderEditorWithToolbars(editorRef, extensions, editorProps, toolbarSlots);
};

// ============================================================================
// TOOLBAR MANAGEMENT: Hook composition
// ============================================================================

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
    handlers: { handleOriginalToolbarVisibilityChange }
  };
};

const buildEditorProps = () => ({
  attributes: {
    class: "tiptap ProseMirror",
    spellcheck: "true",
  },
  handleDOMEvents: {
    click: createLinkClickHandler()
  },
});

const buildToolbarSlots = (
  editorRef: React.RefObject<HTMLDivElement>,
  toolbarRef: React.RefObject<HTMLDivElement>,
  toolbarState: { originalToolbarVisible: boolean },
  handlers: { handleOriginalToolbarVisibilityChange: (visible: boolean) => void }
) => ({
  slotBefore: (
    <div
      ref={toolbarRef}
      className={`toolbar-container ${toolbarState.originalToolbarVisible ? 'visible' : 'hidden'}`}
    >
      <SimpleToolbar containerRef={editorRef} />
    </div>
  ),
  slotAfter: (
    <FloatingToolbar
      editorRef={editorRef}
      toolbarRef={toolbarRef}
      headerHeight={64}
      onOriginalToolbarVisibilityChange={
        handlers.handleOriginalToolbarVisibilityChange
      }
    />
  )
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
    />
  </div>
);

// ============================================================================
// EVENT HANDLERS: Specific implementation details
// ============================================================================

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

const isShiftClickOnLink = (target: HTMLElement, event: MouseEvent): boolean => {
  return !!(
    (target.tagName === "A" || target.parentElement?.tagName === "A") &&
    event.shiftKey
  );
};

const openLinkInNewTab = (target: HTMLElement) => {
  const href = target.getAttribute("href") || target.parentElement?.getAttribute("href");
  if (href) {
    window.open(href, "_blank")?.focus();
  }
};

const handleEditorContentError = (error: unknown) => {
  console.error("Editor content error:", error);
};

export { CoachingNotes };
