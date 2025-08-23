"use client";

import { EditorProvider, useEditor, EditorContent } from "@tiptap/react";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { SimpleToolbar } from "@/components/ui/coaching-sessions/coaching-notes/simple-toolbar";
import { FloatingToolbar } from "@/components/ui/coaching-sessions/coaching-notes/floating-toolbar";
import { useEditorCache } from "@/components/ui/coaching-sessions/editor-cache-context";
import type { Extensions } from "@tiptap/core";
import "@/styles/simple-editor.scss";

const CoachingNotes = () => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const { yDoc, extensions, isReady, isLoading, error } = useEditorCache();

  // Use extensions from cache - they're already validated and ready
  const activeExtensions = useMemo((): Extensions => {
    if (isReady && extensions.length > 0) {
      if (process.env.NODE_ENV === "development") {
        console.log("🔧 Using cached extensions:", extensions.length);
      }
      return extensions;
    }

    // Return empty array while loading - will show loading state
    return [];
  }, [isReady, extensions]);

  // Simulate loading progress
  useEffect(() => {
    if (isLoading) {
      setLoadingProgress(0);
      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90; // Stop at 90% until actually loaded
          }
          return prev + Math.random() * 15;
        });
      }, 150);

      return () => clearInterval(interval);
    } else {
      // Complete the progress (100%) when loading is done
      setLoadingProgress(100);
    }
  }, [isLoading]);

  if (isLoading) {
    return (
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
  }

  if (error) {
    return (
      <div className="coaching-notes-editor">
        <div className="coaching-notes-error">
          <div className="text-center">
            <p className="mb-2">⚠️ Could not load coaching notes</p>
            <p className="text-sm opacity-80">
              {error.message ||
                "Please try again later or contact support if the issue persists."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show cached editor once ready
  if (isReady && activeExtensions.length > 0) {
    try {
      return <CoachingNotesWithFloatingToolbar extensions={activeExtensions} />;
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
  }

  // Fallback - should rarely be seen due to loading state above
  return (
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
};

// Wrapper component with floating toolbar functionality
const CoachingNotesWithFloatingToolbar: React.FC<{
  extensions: Extensions;
}> = ({ extensions }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [originalToolbarVisible, setOriginalToolbarVisible] = useState(true);

  const handleOriginalToolbarVisibilityChange = useCallback(
    (visible: boolean) => {
      setOriginalToolbarVisible(visible);
    },
    []
  );

  return (
    <div ref={editorRef} className="coaching-notes-editor">
      <EditorProvider
        extensions={extensions}
        autofocus={false}
        immediatelyRender={false}
        shouldRerenderOnTransaction={false}
        onContentError={(error) =>
          console.error("Editor content error:", error)
        }
        editorProps={{
          attributes: {
            class: "tiptap ProseMirror",
            spellcheck: "true",
          },
          handleDOMEvents: {
            click: (view, event) => {
              const target = event.target as HTMLElement;
              // Check if the clicked element is an <a> tag and Shift is pressed
              if (
                (target.tagName === "A" ||
                  target.parentElement?.tagName === "A") &&
                event.shiftKey
              ) {
                event.preventDefault(); // Prevent default link behavior
                const href =
                  target.getAttribute("href") ||
                  target.parentElement?.getAttribute("href");
                if (href) {
                  window.open(href, "_blank")?.focus();
                }
                return true; // Stop event propagation
              }
              return false; // Allow other handlers to process the event
            },
          },
        }}
        slotBefore={
          <div
            ref={toolbarRef}
            className={`toolbar-container ${originalToolbarVisible ? 'visible' : 'hidden'}`}
          >
            <SimpleToolbar containerRef={editorRef} />
          </div>
        }
        slotAfter={
          <FloatingToolbar
            editorRef={editorRef}
            toolbarRef={toolbarRef}
            headerHeight={64} // Can be made configurable via props or site config
            onOriginalToolbarVisibilityChange={
              handleOriginalToolbarVisibilityChange
            }
          />
        }
      />
    </div>
  );
};

export { CoachingNotes };
