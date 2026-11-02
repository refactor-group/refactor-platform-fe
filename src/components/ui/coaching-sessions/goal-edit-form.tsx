"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/lib/utils";
import { CARD_BUTTON, CARD_TEXTAREA, FIELD_LABEL } from "@/components/ui/card-field";

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
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="goal-title" className={FIELD_LABEL}>
          Title
        </label>
        <input
          id="goal-title"
          ref={setInputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Goal title"
          className={cn(CARD_TEXTAREA, "font-medium placeholder:text-muted-foreground/60")}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="goal-description" className={FIELD_LABEL}>
          Description
        </label>
        <textarea
          id="goal-description"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add detail to your goal..."
          className={cn(CARD_TEXTAREA, "placeholder:text-muted-foreground/60")}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          className={CARD_BUTTON}
          disabled={!title.trim() || !hasChanges}
          onClick={handleSave}
        >
          Save
        </Button>
        <Button
          variant="tertiary"
          size="sm"
          className={CARD_BUTTON}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
