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
import {
  StatusSelect,
  DueDatePicker,
  AssigneePickerPopover,
  resolveAssignees,
  getInitials,
} from "@/components/ui/coaching-sessions/action-card-parts";
import type { Action } from "@/types/action";
import { ItemStatus, Id } from "@/types/general";
import { cn } from "@/components/lib/utils";
import { DateTime } from "ts-luxon";

// ── Compact Action Card (flip-card interaction) ──────────────────────
//
// Uses CompactFlipCard with header/footer for a three-zone front face:
//   Header: Status pill (interactive) + flip icon
//   Body:   Expandable action text
//   Footer: Assignee initials + due date
//
// Back face provides full edit form for body, status, due date, assignees.
// Review variant makes body read-only and hides delete.

export interface CompactActionCardProps {
  action: Action;
  locale: string;
  coachId: Id;
  coachName: string;
  coacheeId: Id;
  coacheeName: string;
  onStatusChange: (id: Id, newStatus: ItemStatus) => void;
  onDueDateChange: (id: Id, newDueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  onBodyChange: (id: Id, newBody: string) => Promise<void>;
  onDelete?: (id: Id) => void;
  /** "review" makes body read-only and hides delete. Defaults to "current". */
  variant?: "current" | "review";
  /** When true, card starts in edit mode (used for new actions). */
  initialEditing?: boolean;
  /** Called when the user dismisses an initial-editing card. */
  onDismiss?: () => void;
  className?: string;
}

export function CompactActionCard({
  action,
  locale,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
  onBodyChange,
  onDelete,
  variant = "current",
  initialEditing = false,
  onDismiss,
  className,
}: CompactActionCardProps) {
  const body = action.body ?? "";
  const isReview = variant === "review";
  const isOverdue =
    action.due_by < DateTime.now() &&
    action.status !== ItemStatus.Completed &&
    action.status !== ItemStatus.WontDo;

  const assigneeIds = action.assignee_ids ?? [];
  const { allAssignees, resolvedAssignees } = resolveAssignees(
    assigneeIds,
    coachId,
    coachName,
    coacheeId,
    coacheeName
  );

  const handleAssigneeToggle = useCallback(
    (assigneeId: Id) => {
      const updated = assigneeIds.includes(assigneeId)
        ? assigneeIds.filter((id) => id !== assigneeId)
        : [...assigneeIds, assigneeId];
      onAssigneesChange(action.id, updated);
    },
    [assigneeIds, onAssigneesChange, action.id]
  );

  return (
    <CompactFlipCard
      canFlip
      initialEditing={initialEditing}
      onDismiss={onDismiss}
      className={className}
      renderHeader={({ onFlip }) => (
        <ActionHeader
          status={action.status}
          onStatusChange={(newStatus) => onStatusChange(action.id, newStatus)}
          onFlip={onFlip}
        />
      )}
      renderFront={() => (
        <ActionBody body={body} />
      )}
      renderFooter={() => (
        <ActionFooter
          resolvedAssignees={resolvedAssignees}
          dueBy={action.due_by}
          locale={locale}
          isOverdue={isOverdue}
        />
      )}
      renderBack={({ onDone, isEditing, onEditStart, onEditEnd }) =>
        isEditing ? (
          <ActionEditForm
            action={action}
            locale={locale}
            isReview={isReview}
            initialBody={body}
            allAssignees={allAssignees}
            resolvedAssignees={resolvedAssignees}
            assigneeIds={assigneeIds}
            onStatusChange={(newStatus) => onStatusChange(action.id, newStatus)}
            onDueDateChange={(newDueBy) => onDueDateChange(action.id, newDueBy)}
            onAssigneeToggle={handleAssigneeToggle}
            onSave={async (newBody) => {
              await onBodyChange(action.id, newBody);
              if (!initialEditing) onEditEnd();
            }}
            onCancel={onDismiss ? onDone : onEditEnd}
            onDelete={
              !isReview && onDelete
                ? () => {
                    onDelete(action.id);
                    onDone();
                  }
                : undefined
            }
          />
        ) : (
          <ActionBackView
            action={action}
            body={body}
            locale={locale}
            isReview={isReview}
            isOverdue={isOverdue}
            resolvedAssignees={resolvedAssignees}
            onDone={onDone}
            onEdit={onEditStart}
            onDelete={
              !isReview && onDelete
                ? () => {
                    onDelete(action.id);
                    onDone();
                  }
                : undefined
            }
          />
        )
      }
    />
  );
}

// ── Front face: Header ──────────────────────────────────────────────

function ActionHeader({
  status,
  onStatusChange,
  onFlip,
}: {
  status: ItemStatus;
  onStatusChange: (newStatus: ItemStatus) => void;
  onFlip: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <StatusSelect status={status} onStatusChange={onStatusChange} />
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Action options"
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
            Edit action details
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// ── Front face: Body ────────────────────────────────────────────────

function ActionBody({ body }: { body: string }) {
  if (!body) {
    return (
      <span className="text-[13px] text-muted-foreground/50 italic">
        No description
      </span>
    );
  }

  return <ExpandableContent text={body} className="text-[13px] font-medium" />;
}

// ── Front face: Footer ──────────────────────────────────────────────

function ActionFooter({
  resolvedAssignees,
  dueBy,
  locale,
  isOverdue,
}: {
  resolvedAssignees: { initials: string; name: string }[];
  dueBy: DateTime;
  locale: string;
  isOverdue: boolean;
}) {
  const formattedDate = dueBy
    .setLocale(locale)
    .toLocaleString(DateTime.DATE_MED);

  return (
    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
      <div className="flex items-center gap-1">
        {resolvedAssignees.map((a) => (
          <TooltipProvider key={a.initials} delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[11px] font-medium">{a.initials}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {a.name}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
      <span
        data-testid="action-due-date"
        className={cn("text-[11px]", isOverdue && "font-bold")}
      >
        {formattedDate}
      </span>
    </div>
  );
}

// ── Back face: View mode ────────────────────────────────────────────

function ActionBackView({
  action,
  body,
  locale,
  isReview,
  isOverdue,
  resolvedAssignees,
  onDone,
  onEdit,
  onDelete,
}: {
  action: Action;
  body: string;
  locale: string;
  isReview: boolean;
  isOverdue: boolean;
  resolvedAssignees: { initials: string; name: string }[];
  onDone: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const formattedDate = action.due_by
    .setLocale(locale)
    .toLocaleString(DateTime.DATE_MED);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground/60">
          Due: {formattedDate}
        </span>
        <button
          type="button"
          onClick={onDone}
          className="text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Done
        </button>
      </div>

      <p className="text-[13px] font-medium whitespace-pre-wrap">
        {body || <span className="text-muted-foreground/50 italic">No description</span>}
      </p>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {resolvedAssignees.map((a) => a.name).join(", ") || "Unassigned"}
        </span>
      </div>

      <div className="flex items-center justify-end gap-2 pt-3">
        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1 text-[11px] px-2"
          onClick={onEdit}
        >
          <Pencil className="!h-2.5 !w-2.5" />
          Edit
        </Button>
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

// ── Back face: Edit form ────────────────────────────────────────────

function ActionEditForm({
  action,
  locale,
  isReview,
  initialBody,
  allAssignees,
  resolvedAssignees,
  assigneeIds,
  onStatusChange,
  onDueDateChange,
  onAssigneeToggle,
  onSave,
  onCancel,
  onDelete,
}: {
  action: Action;
  locale: string;
  isReview: boolean;
  initialBody: string;
  allAssignees: { id: Id; name: string; initials: string }[];
  resolvedAssignees: { id: Id; name: string; initials: string }[];
  assigneeIds: Id[];
  onStatusChange: (newStatus: ItemStatus) => void;
  onDueDateChange: (newDueBy: DateTime) => void;
  onAssigneeToggle: (assigneeId: Id) => void;
  onSave: (body: string) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
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
      {isReview ? (
        <p className="text-[13px] font-medium whitespace-pre-wrap min-h-[60px]">
          {initialBody}
        </p>
      ) : (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full min-h-[80px] rounded-md border border-border bg-background px-2 py-1.5 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Status</span>
          <StatusSelect
            status={action.status}
            onStatusChange={onStatusChange}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Due date</span>
          <DueDatePicker
            value={action.due_by}
            onChange={onDueDateChange}
            locale={locale}
            variant="button"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Assignee(s)</span>
          <AssigneePickerPopover
            allAssignees={allAssignees}
            resolvedAssignees={resolvedAssignees}
            assigneeIds={assigneeIds}
            onToggle={onAssigneeToggle}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-3">
        <div>
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
        <div className="flex items-center gap-2">
          {!isReview && (
            <Button
              size="sm"
              className="h-6 gap-1 text-[11px] px-2"
              onClick={handleSave}
              disabled={isSaving || !body.trim()}
            >
              Save
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-[11px] px-2 text-muted-foreground"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
