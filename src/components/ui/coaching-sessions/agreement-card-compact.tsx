"use client";

import { useState, useCallback } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/components/lib/utils";
import {
  CARD_BUTTON,
  CARD_DONE,
  CARD_FACE,
  CARD_TEXTAREA,
  CARD_TITLE,
  CardDetailsButton,
} from "@/components/ui/card-field";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BaseCardCompactEditable } from "@/components/ui/base-card-compact-editable";
import { ContentExpandable } from "@/components/ui/content-expandable";
import type { Agreement } from "@/types/agreement";
import { type Option, None } from "@/types/option";
import type { NoteField } from "@/types/note-selection";
import { useFieldPrefill } from "@/lib/hooks/use-field-prefill";

// ── Compact Agreement Card (flip-card interaction) ───────────────────
//
// Uses BaseCardCompactEditable for shared card infrastructure.
// Simpler than goal cards: no progress bar, no status, no linking.
// Just body text, a created date, and edit/delete actions.

export interface CompactAgreementCardProps {
  agreement: Agreement;
  locale: string;
  /** Called with the new body text when the user saves (create or edit). */
  onSave?: (body: string) => Promise<void>;
  onDelete?: (id: string) => void;
  /** When true, card starts flipped to edit mode (used for new agreements). */
  initialEditing?: boolean;
  /** Notes selection appended into the edit body on nonce change. */
  bodyAppend?: Option<NoteField>;
  /** Called when the user cancels out of initial editing (dismisses the card). */
  onDismiss?: () => void;
}

export function CompactAgreementCard({
  agreement,
  locale,
  onSave,
  onDelete,
  initialEditing = false,
  bodyAppend = None,
  onDismiss,
}: CompactAgreementCardProps) {
  const canInteract = Boolean(onSave || onDelete || initialEditing);
  // Normalize optional body at the component boundary (Agreement.body is string | undefined)
  const body = agreement.body ?? "";
  const formattedDate = agreement.created_at.toLocaleString(
    { month: "short", day: "numeric", year: "numeric" },
    { locale }
  );
  const agreedDate = agreement.created_at.toLocaleString(
    { weekday: "long", month: "long", day: "numeric", year: "numeric" },
    { locale }
  );

  return (
    <BaseCardCompactEditable
      canFlip={canInteract}
      initialEditing={initialEditing}
      onDismiss={onDismiss}
      faceClassName={CARD_FACE}
      renderFront={({ onFlip }) => (
        <AgreementFrontFace
          body={body}
          canInteract={canInteract}
          onFlip={onFlip}
        />
      )}
      renderBack={({ onDone, isEditing, onEditStart, onEditEnd }) =>
        isEditing ? (
          <AgreementEditForm
            initialBody={body}
            bodyAppend={bodyAppend}
            onSave={async (newBody) => {
              if (onSave) await onSave(newBody);
              if (!initialEditing) onEditEnd();
            }}
            // In initial-editing mode (new card), Cancel dismisses the entire card via onDone.
            // In flip-to-edit mode (existing card), Cancel returns to the back face view.
            onCancel={onDismiss ? onDone : onEditEnd}
          />
        ) : (
          <AgreementBackFace
            body={body}
            formattedDate={formattedDate}
            agreedDate={agreedDate}
            onDone={onDone}
            onEdit={onSave ? onEditStart : undefined}
            onDelete={onDelete ? () => {
              onDelete(agreement.id);
              onDone();
            } : undefined}
          />
        )
      }
    />
  );
}

// ── Front face content ──────────────────────────────────────────────

function AgreementFrontFace({
  body,
  canInteract,
  onFlip,
}: {
  body: string;
  canInteract: boolean;
  onFlip: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <ContentExpandable text={body} className={CARD_TITLE} />
      {canInteract && (
        <CardDetailsButton
          label="Agreement options"
          tooltip="Edit or delete agreement"
          onClick={onFlip}
        />
      )}
    </div>
  );
}

// ── Back face content ───────────────────────────────────────────────

function AgreementBackFace({
  body,
  formattedDate,
  agreedDate,
  onDone,
  onEdit,
  onDelete,
}: {
  body: string;
  formattedDate: string;
  agreedDate: string;
  onDone: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default text-xs tabular-nums text-muted-foreground">
                Agreed {formattedDate}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Agreed on {agreedDate}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <button type="button" onClick={onDone} className={CARD_DONE}>
          Done
        </button>
      </div>

      <p className={cn(CARD_TITLE, "whitespace-pre-wrap")}>
        {body}
      </p>

      <div className="flex items-center justify-end gap-2 pt-3">
        {onEdit && (
          <Button variant="secondary" size="sm" className={CARD_BUTTON} onClick={onEdit}>
            <Pencil className="!h-3 !w-3" aria-hidden />
            Edit
          </Button>
        )}
        {onDelete && (
          <Button variant="destructive" size="sm" className={CARD_BUTTON} onClick={onDelete}>
            <Trash2 className="!h-3 !w-3" aria-hidden />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Edit form ───────────────────────────────────────────────────────

function AgreementEditForm({
  initialBody,
  bodyAppend = None,
  onSave,
  onCancel,
}: {
  initialBody: string;
  bodyAppend?: Option<NoteField>;
  onSave: (body: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(initialBody);
  const [isSaving, setIsSaving] = useState(false);

  // Append the notes selection once per nonce (an empty body is just filled).
  useFieldPrefill(bodyAppend, (text) =>
    setBody((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))
  );

  const handleSave = useCallback(async () => {
    if (!body.trim()) return;
    setIsSaving(true);
    try {
      await onSave(body.trim());
    } finally {
      setIsSaving(false);
    }
  }, [body, onSave]);

  return (
    <div className="space-y-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={cn(CARD_TEXTAREA, "min-h-[120px]")}
        autoFocus
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          className={CARD_BUTTON}
          onClick={handleSave}
          disabled={isSaving || !body.trim()}
        >
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(CARD_BUTTON, "text-muted-foreground")}
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
