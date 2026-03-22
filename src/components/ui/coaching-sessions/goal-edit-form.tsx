"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

// ── Goal Edit Form ──────────────────────────────────────────────────

export interface GoalEditFormProps {
  initialTitle: string;
  initialBody: string;
  onSave: (title: string, body: string) => Promise<void>;
  onCancel: () => void;
}

export function GoalEditForm({
  initialTitle,
  initialBody,
  onSave,
  onCancel,
}: GoalEditFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const inputRef = useRef<HTMLInputElement>(null);

  const setInputRef = useCallback((el: HTMLInputElement | null) => {
    (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const hasChanges =
    title.trim() !== initialTitle || body !== initialBody;

  const handleSave = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    await onSave(trimmed, body);
  }, [title, body, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (hasChanges) handleSave();
      }
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [handleSave, hasChanges, onCancel]
  );

  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-2">
      <input
        ref={setInputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Goal title"
        className="w-full rounded-md border border-border/50 bg-background px-2 py-1.5 text-[12px] font-medium placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-border"
      />

      <textarea
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add detail to your goal..."
        className="w-full rounded-md border border-border/50 bg-background px-2 py-1.5 text-[12px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-border resize-none"
      />

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1 h-8 text-xs"
          disabled={!title.trim() || !hasChanges}
          onClick={handleSave}
        >
          Save
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
