"use client";

import { useState, useRef, useEffect, type DragEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { ItemStatus, Id, EntityApiError } from "@/types/general";
import type { Action } from "@/types/action";
import { cn } from "@/components/lib/utils";
import { DateTime } from "ts-luxon";
import {
  type AssigneeInfo,
  resolveAssignees,
  AssigneePickerPopover,
  DueDatePicker,
} from "@/components/ui/coaching-sessions/action-card-parts";

interface GhostActionCardProps {
  coachId: Id;
  coachName: string;
  coacheeId: Id;
  coacheeName: string;
  onCreateAction: (
    body: string,
    status: ItemStatus,
    dueBy: DateTime,
    assigneeIds?: Id[]
  ) => Promise<Action>;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface GhostCardFormProps {
  body: string;
  onBodyChange: (body: string) => void;
  dueBy: DateTime;
  onDueByChange: (dueBy: DateTime) => void;
  allAssignees: AssigneeInfo[];
  resolvedAssignees: AssigneeInfo[];
  assigneeIds: Id[];
  onAssigneeToggle: (assigneeId: Id) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

function GhostCardForm({
  body,
  onBodyChange,
  dueBy,
  onDueByChange,
  allAssignees,
  resolvedAssignees,
  assigneeIds,
  onAssigneeToggle,
  onSave,
  onCancel,
  isSaving,
}: GhostCardFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <Card className="h-56 border-2 border-dashed border-primary/30">
      <CardContent className="flex flex-col gap-3 p-4">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSave();
            }
            if (e.key === "Escape") {
              onCancel();
            }
          }}
          placeholder="What needs to be done?"
          className="flex-1 resize-none rounded border border-input bg-background px-2 py-1 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          rows={3}
          disabled={isSaving}
        />

        {/* Due date + Assignee row */}
        <div className="flex flex-wrap items-center gap-2">
          <DueDatePicker
            value={dueBy}
            onChange={onDueByChange}
            variant="button"
            disabled={isSaving}
          />
          <AssigneePickerPopover
            allAssignees={allAssignees}
            resolvedAssignees={resolvedAssignees}
            assigneeIds={assigneeIds}
            onToggle={onAssigneeToggle}
            disabled={isSaving}
          />
        </div>

        {/* Save / Cancel */}
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving || !body.trim()}
          >
            {isSaving ? "Saving..." : "Add"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface GhostCardPlaceholderProps {
  onActivate: () => void;
  disabled: boolean;
  isDragOver: boolean;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
}

function GhostCardPlaceholder({
  onActivate,
  disabled,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: GhostCardPlaceholderProps) {
  return (
    <button
      type="button"
      onClick={onActivate}
      disabled={disabled}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "h-56 w-full rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-muted-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        isDragOver
          ? "border-primary bg-primary/5 text-foreground"
          : "border-muted-foreground/25 hover:border-primary/50 hover:text-foreground"
      )}
    >
      <Plus className="h-5 w-5" />
      <span className="text-sm">
        {isDragOver ? "Drop to create action" : "Add action"}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const GhostActionCard = ({
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onCreateAction,
  disabled = false,
}: GhostActionCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [body, setBody] = useState("");
  const [dueBy, setDueBy] = useState<DateTime>(
    DateTime.now().plus({ days: 7 })
  );
  const [assigneeIds, setAssigneeIds] = useState<Id[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const { allAssignees, resolvedAssignees } = resolveAssignees(
    assigneeIds,
    coachId,
    coachName,
    coacheeId,
    coacheeName
  );

  const handleAssigneeToggle = (assigneeId: Id) => {
    setAssigneeIds((prev) =>
      prev.includes(assigneeId)
        ? prev.filter((id) => id !== assigneeId)
        : [...prev, assigneeId]
    );
  };

  const resetForm = () => {
    setBody("");
    setDueBy(DateTime.now().plus({ days: 7 }));
    setAssigneeIds([]);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;

    setIsSaving(true);
    try {
      await onCreateAction(
        trimmed,
        ItemStatus.NotStarted,
        dueBy,
        assigneeIds.length > 0 ? assigneeIds : undefined
      );
      resetForm();
    } catch (err) {
      if (err instanceof EntityApiError && err.isNetworkError()) {
        toast.error("Failed to create new action. Connection to service was lost.");
      } else {
        toast.error("Failed to create new action.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // -- Drag-and-drop handlers ------------------------------------------------

  const hasTextData = (dt: DataTransfer) =>
    dt.types.includes("text/plain") && !dt.types.includes("Files");

  const handleDragOver = (e: DragEvent) => {
    if (!hasTextData(e.dataTransfer)) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    if (!hasTextData(e.dataTransfer)) return;
    e.preventDefault();
    setIsDragOver(false);
    const text = e.dataTransfer.getData("text/plain").trim();
    if (text && !disabled) {
      setBody(text);
      setIsEditing(true);
    }
  };

  // -- Render -----------------------------------------------------------------

  if (isEditing) {
    return (
      <GhostCardForm
        body={body}
        onBodyChange={setBody}
        dueBy={dueBy}
        onDueByChange={setDueBy}
        allAssignees={allAssignees}
        resolvedAssignees={resolvedAssignees}
        assigneeIds={assigneeIds}
        onAssigneeToggle={handleAssigneeToggle}
        onSave={handleSave}
        onCancel={resetForm}
        isSaving={isSaving}
      />
    );
  }

  return (
    <GhostCardPlaceholder
      onActivate={() => setIsEditing(true)}
      disabled={disabled}
      isDragOver={isDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    />
  );
};

export { GhostActionCard };
export type { GhostActionCardProps };
