"use client";

import { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/components/lib/utils";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { isUserCoachInRelationship, isUserCoacheeInRelationship } from "@/types/coaching-relationship";
import { getCoachName, getCoacheeName } from "@/lib/utils/relationship";
import { CompactActionCard } from "@/components/ui/coaching-sessions/action-card-compact";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import type { Id, ItemStatus } from "@/types/general";
import type { DateTime } from "ts-luxon";

/** Shared props forwarded from the board through columns to each card */
export interface KanbanCardCallbacks {
  locale: string;
  onStatusChange: (id: Id, newStatus: ItemStatus) => void;
  onDueDateChange: (id: Id, newDueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  onBodyChange: (id: Id, newBody: string) => Promise<void>;
  onDelete?: (id: Id) => void;
}

export interface KanbanActionCardProps extends KanbanCardCallbacks {
  ctx: AssignedActionWithContext;
  /** When true, render as a static preview (used in DragOverlay) */
  isOverlay?: boolean;
  /** When true, show a brief highlight ring (just moved via drag-and-drop) */
  justMoved?: boolean;
}

/**
 * Heavy card content — memoized separately so it is NOT re-rendered by
 * dnd-kit's internal context updates during drag. `useDraggable` subscribes
 * to InternalContext which changes on every pointer move; without this split,
 * every card would re-render continuously.
 */
const KanbanActionCardContent = memo(function KanbanActionCardContent({
  ctx,
  locale,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
  onBodyChange,
  onDelete,
  coachLabel,
  coacheeLabel,
}: KanbanCardCallbacks & {
  ctx: AssignedActionWithContext;
  coachLabel: string;
  coacheeLabel: string;
}) {
  return (
    <>
      {/* Relationship header */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground border border-b-0 border-border rounded-t-lg bg-muted/40">
        <span className="truncate">
          {coachLabel} → {coacheeLabel}
        </span>
      </div>

      <CompactActionCard
        action={ctx.action}
        locale={locale}
        coachId={ctx.relationship.coach_id}
        coachName={getCoachName(ctx.relationship)}
        coacheeId={ctx.relationship.coachee_id}
        coacheeName={getCoacheeName(ctx.relationship)}
        onStatusChange={onStatusChange}
        onDueDateChange={onDueDateChange}
        onAssigneesChange={onAssigneesChange}
        onBodyChange={onBodyChange}
        onDelete={onDelete}
        variant="current"
        className="rounded-t-none"
      />
    </>
  );
});

/**
 * Thin draggable shell — re-renders on every dnd-kit context update during
 * drag, but only renders a wrapper div. The heavy content is in
 * KanbanActionCardContent which is memoized and skips these re-renders.
 *
 * The entire card is the drag handle (grab from anywhere). DnD-kit
 * distinguishes drag from click via pointer movement threshold, so click
 * interactions (status pill, expand, flip) still work naturally.
 */
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
  const userId = useAuthStore((state) => state.userSession?.id ?? null);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: ctx.action.id,
      data: { status: ctx.action.status },
      disabled: isOverlay,
    });

  const style: React.CSSProperties = {
    contain: "layout style paint",
    ...(transform ? { transform: CSS.Translate.toString(transform) } : undefined),
  };

  const coachLabel = userId && isUserCoachInRelationship(userId, ctx.relationship)
    ? "You"
    : getCoachName(ctx.relationship);
  const coacheeLabel = userId && isUserCoacheeInRelationship(userId, ctx.relationship)
    ? "You"
    : getCoacheeName(ctx.relationship);

  return (
    <div
      ref={!isOverlay ? setNodeRef : undefined}
      style={style}
      data-kanban-card
      className={cn(
        "relative group rounded-lg cursor-grab active:cursor-grabbing transition-[box-shadow] duration-700",
        isDragging && "opacity-50",
        isOverlay && "opacity-90 shadow-lg rotate-2",
        justMoved && "ring-2 ring-primary/40"
      )}
      {...(!isOverlay ? { ...attributes, ...listeners, "aria-label": "Drag to move" } : {})}
    >
      <KanbanActionCardContent
        ctx={ctx}
        locale={locale}
        onStatusChange={onStatusChange}
        onDueDateChange={onDueDateChange}
        onAssigneesChange={onAssigneesChange}
        onBodyChange={onBodyChange}
        onDelete={onDelete}
        coachLabel={coachLabel}
        coacheeLabel={coacheeLabel}
      />
    </div>
  );
}
