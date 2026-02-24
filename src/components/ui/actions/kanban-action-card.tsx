"use client";

import { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { isUserCoachInRelationship, isUserCoacheeInRelationship } from "@/types/coaching-relationship";
import { getCoachName, getCoacheeName } from "@/lib/utils/relationship";
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

/**
 * Heavy card content — memoized separately so it is NOT re-rendered by
 * dnd-kit's internal context updates during drag. `useDraggable` subscribes
 * to InternalContext which changes on every pointer move; without this split,
 * every card (including its ReactMarkdown body) would re-render continuously.
 */
const KanbanActionCardContent = memo(function KanbanActionCardContent({
  ctx,
  locale,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
  onBodyChange,
  onDelete,
  isOverlay,
  coachLabel,
  coacheeLabel,
}: KanbanCardCallbacks & {
  ctx: AssignedActionWithContext;
  isOverlay: boolean;
  coachLabel: string;
  coacheeLabel: string;
}) {
  return (
    <>
      {/* Relationship header (visual only — drag listeners are on the outer shell) */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground border border-b-0 border-border rounded-t-xl bg-muted/40",
          !isOverlay && "cursor-grab active:cursor-grabbing"
        )}
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
        <span className="truncate">
          {coachLabel} → {coacheeLabel}
        </span>
      </div>

      <SessionActionCard
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
        showSessionLink
        sessionDate={ctx.sourceSession.sessionDate}
        className="rounded-t-none"
        lightweight={isOverlay}
        autoHeight={false}
      />
    </>
  );
});

/**
 * Thin draggable shell — re-renders on every dnd-kit context update during
 * drag, but only renders a wrapper div. The heavy content is in
 * KanbanActionCardContent which is memoized and skips these re-renders.
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
        "relative group rounded-xl transition-[box-shadow] duration-700",
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
        isOverlay={isOverlay}
        coachLabel={coachLabel}
        coacheeLabel={coacheeLabel}
      />
    </div>
  );
}
