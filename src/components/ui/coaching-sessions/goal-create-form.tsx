"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

// ── Goal Create Form ────────────────────────────────────────────────

export interface GoalCreateFormProps {
  onSubmit: (title: string, body?: string) => void;
  onCancel: () => void;
  /** Label for the submit button */
  submitLabel: string;
}

export function GoalCreateForm({
  onSubmit,
  onCancel,
  submitLabel,
}: GoalCreateFormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [showBody, setShowBody] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  const setInputRef = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (el) el.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const trimmedBody = body.trim() || undefined;
    await onSubmit(trimmed, trimmedBody);
  }, [title, body, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [handleSubmit, onCancel]
  );

  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-2">
      <div className="space-y-1">
        <label htmlFor="goal-title" className="text-[12px] font-medium text-foreground/70">
          Goal
        </label>
        <input
          id="goal-title"
          ref={setInputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What do you want to achieve?"
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px] font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/30"
        />
      </div>

      {showBody ? (
        <div className="space-y-1">
          <label htmlFor="goal-description" className="text-[12px] font-medium text-foreground/70">
            Description
          </label>
          <textarea
            id="goal-description"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add detail to your goal..."
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/30 resize-none"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowBody(true)}
          className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          + Add a longer goal description
        </button>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-8 text-xs px-4"
          disabled={!title.trim()}
          onClick={handleSubmit}
        >
          {submitLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
