"use client";

import { EditorProvider } from "@tiptap/react";
import { FileText } from "lucide-react";
import { SimpleToolbar } from "@/components/ui/coaching-sessions/coaching-notes/simple-toolbar";
import { LinkBubbleMenu } from "@/components/ui/tiptap-ui/link-bubble-menu/link-bubble-menu";
import { SelectionBubbleMenu } from "@/components/ui/tiptap-ui/selection-bubble-menu/selection-bubble-menu";
import { useEditorCache } from "@/components/ui/coaching-sessions/editor-cache-context";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Extensions } from "@tiptap/core";
import { toast } from "sonner";
import "@/styles/simple-editor.scss";
import "@/styles/tiptap-table.scss";

// Main component: orchestrates editor state and rendering logic

interface CoachingNotesProps {
  onAddAsAction?: (selectedText: string) => void;
}

const CoachingNotes = ({ onAddAsAction }: CoachingNotesProps) => {
  const { extensions, isReady, isLoading, error, resetCache } = useEditorCache();

  if (error) {
    return renderErrorState(error, resetCache);
  }

  if (isLoading || extensions.length === 0) {
    return renderLoadingState();
  }

  return renderReadyEditor(extensions, isReady, onAddAsAction);
};

const renderLoadingState = () => (
  <div className="coaching-notes-editor">
    <div className="toolbar-container">
      <div className="flex items-center gap-2 p-2">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-px bg-border mx-1" />
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
    <div className="coaching-notes-loading">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Loading coaching notes...</p>
    </div>
  </div>
);

const renderErrorState = (error: Error | null, onRetry: () => void) => (
  <div className="coaching-notes-editor">
    <div className="coaching-notes-error">
      <div className="flex flex-col items-center text-center">
        <FileText className="size-12 text-muted-foreground mb-4" />
        <p className="mb-2 font-medium">Could not load coaching notes</p>
        <p className="text-sm text-muted-foreground mb-4">
          {error?.message ||
            "Please try again later or contact support if the issue persists."}
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      </div>
    </div>
  </div>
);

const renderReadyEditor = (
  extensions: Extensions,
  isReady: boolean,
  onAddAsAction?: (selectedText: string) => void,
) => {
  try {
    return renderReadyEditorContent(extensions, isReady, onAddAsAction);
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

// Editor rendering

const renderReadyEditorContent = (
  extensions: Extensions,
  isReady: boolean,
  onAddAsAction?: (selectedText: string) => void,
) => (
  <div className="coaching-notes-editor">
    <EditorProvider
      extensions={extensions}
      autofocus={false}
      immediatelyRender={false}
      shouldRerenderOnTransaction={false}
      onContentError={handleEditorContentError}
      editorProps={{
        attributes: {
          class: "tiptap ProseMirror",
          spellcheck: "true",
        },
        editable: () => isReady,
        handleDOMEvents: {
          click: createLinkClickHandler(),
        },
      }}
      slotBefore={
        <div className="toolbar-container">
          <SimpleToolbar />
        </div>
      }
    >
      <LinkBubbleMenu />
      {onAddAsAction && <SelectionBubbleMenu onAddAsAction={onAddAsAction} />}
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
