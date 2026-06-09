"use client";

import { useState, type JSX } from "react";
import { Check, Pencil } from "lucide-react";
import { type Option } from "@/types/option";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/lib/utils";

const HEADING_CLASS = "text-lg sm:text-xl font-semibold tracking-tight";
const PLACEHOLDER = "Summarize the main purpose of this session…";
// Clamp the title width so long titles wrap to a few lines instead of growing
// across the whole header. Shared by display + edit so wrapping stays aligned.
const TITLE_MAX_W = "max-w-xl";
// On non-mobile, cap the title at 3 lines (display clamps, edit scrolls) so a
// long title can't balloon the header. Mobile is left free to grow.
const TITLE_MAX_LINES = "sm:line-clamp-3";
const TITLE_MAX_EDIT_H = "sm:max-h-[5.25rem]"; // 3 × 1.75rem line-height

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
      <div className={cn("flex items-start gap-2", TITLE_MAX_W)}>
        {/* Invisible sizer in the same grid cell makes the textarea exactly as
            wide and tall as its content (matching the display label), so the
            save button lands where the pencil sits and the box never bounces. */}
        <div className="grid min-w-0 max-w-full -mx-1">
          <span
            aria-hidden
            className={cn(
              "invisible col-start-1 row-start-1 whitespace-pre-wrap break-words overflow-hidden px-1",
              TITLE_MAX_EDIT_H,
              HEADING_CLASS
            )}
          >
            {draft || PLACEHOLDER}
            {"​"}
          </span>
          <Textarea
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
            placeholder={PLACEHOLDER}
            // Borderless; a soft, thin focus ring outlines the box on edit
            // (lighter than the base ring so it doesn't read as a hard border).
            className={cn(
              "col-start-1 row-start-1 min-h-0 resize-none overflow-hidden rounded-md border-0 px-1 py-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:ring-offset-0 sm:overflow-y-auto",
              TITLE_MAX_EDIT_H,
              HEADING_CLASS
            )}
          />
        </div>
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

  // The pencil mirrors the edit-mode save button exactly (same h-7 ghost
  // button, same row gap) so the affordance never shifts when toggling.
  return (
    <div className={cn("group flex items-start gap-2", TITLE_MAX_W)}>
      <button
        type="button"
        aria-label={title.some ? "Edit title" : "Add a title"}
        onClick={start}
        className="min-w-0 rounded-md -mx-1 px-1 text-left hover:bg-muted/50 transition-colors"
      >
        <span
          className={cn(
            "block break-words",
            TITLE_MAX_LINES,
            HEADING_CLASS,
            title.none && "text-muted-foreground/70 font-medium"
          )}
        >
          {title.some ? title.val : fallbackTitle}
        </span>
      </button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-hidden
        tabIndex={-1}
        onClick={start}
        className="h-7 w-7 shrink-0 rounded-full text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/60 hover:!text-foreground"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}
