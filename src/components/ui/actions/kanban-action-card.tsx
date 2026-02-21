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

/** Shared props forwarded from the board through columns to each card */
export interface KanbanCardCallbacks {
  locale: string;
  onStatusChange: (id: Id, newStatus: ItemStatus) => void;
  onDueDateChange: (id: Id, newDueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  onBodyChange: (id: Id, newBody: string) => void;
  onDelete?: (id: Id) => void;
}

export interface KanbanActionCardProps extends KanbanCardCallbacks {
  ctx: AssignedActionWithContext;
  /** When true, render as a static preview (used in DragOverlay) */
  isOverlay?: boolean;
  /** When true, show a brief highlight ring (just moved via drag-and-drop) */
  justMoved?: boolean;
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
  justMoved = false,
}: KanbanActionCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: ctx.action.id,
      data: { status: ctx.action.status },
      disabled: isOverlay,
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={!isOverlay ? setNodeRef : undefined}
      style={style}
      data-kanban-card
      className={cn(
        "relative group rounded-xl transition-[box-shadow] duration-700",
        isDragging && "opacity-50",
        isOverlay && "opacity-90 shadow-lg rotate-2",
        justMoved && "ring-2 ring-primary/40"
      )}
    >
      {/* Relationship header — doubles as drag handle */}
      <div
        {...(!isOverlay ? { ...attributes, ...listeners, "aria-label": "Drag to move" } : {})}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground border border-b-0 border-border rounded-t-xl bg-muted/40",
          !isOverlay && "cursor-grab active:cursor-grabbing"
        )}
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
        <span className="truncate">
          {ctx.relationship.coachName} → {ctx.relationship.coacheeName}
        </span>
      </div>

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
