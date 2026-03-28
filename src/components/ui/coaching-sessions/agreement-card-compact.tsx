"use client";

import { useState, useCallback } from "react";
import { Info, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CompactFlipCard } from "@/components/ui/coaching-sessions/compact-flip-card";
import { ExpandableContent } from "@/components/ui/coaching-sessions/expandable-content";
import type { Agreement } from "@/types/agreement";

// ── Compact Agreement Card (flip-card interaction) ───────────────────
//
// Uses CompactFlipCard for shared flip infrastructure.
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
  /** Called when the user cancels out of initial editing (dismisses the card). */
  onDismiss?: () => void;
}

export function CompactAgreementCard({
  agreement,
  locale,
  onSave,
  onDelete,
  initialEditing = false,
  onDismiss,
}: CompactAgreementCardProps) {
  const canInteract = Boolean(onSave || onDelete || initialEditing);
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
    <CompactFlipCard
      canFlip={canInteract}
      initialEditing={initialEditing}
      onDismiss={onDismiss}
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
            onSave={async (newBody) => {
              if (onSave) await onSave(newBody);
              if (!initialEditing) onEditEnd();
            }}
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
      <ExpandableContent text={body} className="text-[13px] font-medium" />
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {canInteract ? (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Agreement options"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFlip();
                  }}
                  className="rounded-full p-0.5 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Edit or delete agreement
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
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
              <span className="text-[11px] text-muted-foreground/60 cursor-default">
                {formattedDate}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Agreed on {agreedDate}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <button
          type="button"
          onClick={onDone}
          className="text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Done
        </button>
      </div>

      <p className="text-[13px] font-medium whitespace-pre-wrap">
        {body}
      </p>

      <div className="flex items-center justify-end gap-2 pt-3">
        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 text-[11px] px-2"
            onClick={onEdit}
          >
            <Pencil className="!h-2.5 !w-2.5" />
            Edit
          </Button>
        )}
        {onDelete && (
          <Button
            variant="destructive"
            size="sm"
            className="h-6 gap-1 text-[11px] px-2"
            onClick={onDelete}
          >
            <Trash2 className="!h-2.5 !w-2.5" />
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
  onSave,
  onCancel,
}: {
  initialBody: string;
  onSave: (body: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(initialBody);
  const [isSaving, setIsSaving] = useState(false);

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
        className="w-full min-h-[120px] rounded-md border border-border bg-background px-2 py-1.5 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        autoFocus
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] px-2"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-6 text-[11px] px-2"
          onClick={handleSave}
          disabled={isSaving || !body.trim()}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
