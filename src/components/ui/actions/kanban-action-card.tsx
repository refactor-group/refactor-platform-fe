"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/components/lib/utils";
import {
  SessionActionCard,
} from "@/components/ui/coaching-sessions/session-action-card";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import type { Id, ItemStatus } from "@/types/general";
import type { DateTime } from "ts-luxon";

export interface KanbanActionCardProps {
  ctx: AssignedActionWithContext;
  locale: string;
  onStatusChange: (id: Id, newStatus: ItemStatus) => void;
  onDueDateChange: (id: Id, newDueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  onBodyChange: (id: Id, newBody: string) => void;
  onDelete?: (id: Id) => void;
  /** When true, render as a static preview (used in DragOverlay) */
  isOverlay?: boolean;
}

export function KanbanActionCard({
  ctx,
  locale,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
  onBodyChange,
  onDelete,
  isOverlay = false,
}: KanbanActionCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: ctx.action.id,
      data: { status: ctx.action.status },
      disabled: isOverlay,
    });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={!isOverlay ? setNodeRef : undefined}
      style={style}
      className={cn(
        "relative group",
        isDragging && "opacity-50",
        isOverlay && "opacity-90 shadow-lg rotate-2"
      )}
    >
      {/* Relationship context badge */}
      <div className="px-3 py-1.5 text-xs text-muted-foreground truncate border border-b-0 border-border rounded-t-xl bg-muted/40">
        {ctx.relationship.coachName} → {ctx.relationship.coacheeName}
      </div>

      {/* Drag handle — visible on hover */}
      {!isOverlay && (
        <button
          {...attributes}
          {...listeners}
          className="absolute top-10 left-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded-r bg-muted/80"
          aria-label="Drag to move"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      <SessionActionCard
        action={ctx.action}
        locale={locale}
        coachId={ctx.relationship.coachId}
        coachName={ctx.relationship.coachName}
        coacheeId={ctx.relationship.coacheeId}
        coacheeName={ctx.relationship.coacheeName}
        onStatusChange={onStatusChange}
        onDueDateChange={onDueDateChange}
        onAssigneesChange={onAssigneesChange}
        onBodyChange={onBodyChange}
        onDelete={onDelete}
        variant="current"
        showSessionLink
        sessionDate={ctx.sourceSession.sessionDate}
        className="rounded-t-none"
      />
    </div>
  );
}
