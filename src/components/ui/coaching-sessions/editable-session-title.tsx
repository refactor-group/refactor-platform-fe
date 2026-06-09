"use client";

import { useCallback, useLayoutEffect, useRef, useState, type JSX } from "react";
import { Check, Pencil } from "lucide-react";
import { type Option } from "@/types/option";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/lib/utils";

const HEADING_CLASS = "text-lg sm:text-xl font-semibold tracking-tight";

export interface EditableSessionTitleProps {
  title: Option<string>;
  fallbackTitle: string;
  onSave: (next: string) => void;
}

export function EditableSessionTitle({
  title,
  fallbackTitle,
  onSave,
}: EditableSessionTitleProps): JSX.Element {
  const currentValue = title.some ? title.val : "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);

  // Auto-size the edit textarea to its content so it occupies the same height
  // as the wrapping display label — no vertical jump when toggling edit.
  const taRef = useRef<HTMLTextAreaElement>(null);
  const autosize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useLayoutEffect(() => {
    if (editing) autosize();
  }, [editing, draft, autosize]);

  const start = () => {
    setDraft(currentValue);
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== currentValue) onSave(trimmed);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(currentValue);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-start gap-2">
        <Textarea
          ref={taRef}
          autoFocus
          aria-label="Session title"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Title is conceptually single-line: Enter saves (no newline).
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") cancel();
          }}
          onBlur={commit}
          placeholder="Summarize the main purpose of this session…"
          // Match the display label's box model (no border, -mx-1 px-1, no
          // vertical padding) + a faint bg to signal the active edit.
          className={cn(
            "-mx-1 min-h-0 resize-none overflow-hidden rounded-md border-0 bg-muted/40 px-1 py-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
            HEADING_CLASS
          )}
        />
        <Button
          size="icon"
          variant="ghost"
          aria-label="Save title"
          className="h-7 w-7 shrink-0 rounded-full text-muted-foreground/60 hover:text-foreground"
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
        >
          <Check className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2">
      <button
        type="button"
        aria-label={title.some ? "Edit title" : "Add a title"}
        onClick={start}
        className="flex items-center gap-2 text-left rounded-md -mx-1 px-1 hover:bg-muted/50 transition-colors"
      >
        <span
          className={cn(
            HEADING_CLASS,
            title.none && "text-muted-foreground/70 font-medium"
          )}
        >
          {title.some ? title.val : fallbackTitle}
        </span>
        <Pencil className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
      </button>
    </div>
  );
}
