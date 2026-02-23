"use client";

import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/components/lib/utils";
import { statusColor } from "@/components/ui/actions/utils";
import { actionStatusToString } from "@/types/general";
import { KanbanActionCard } from "@/components/ui/actions/kanban-action-card";
import type { KanbanCardCallbacks } from "@/components/ui/actions/kanban-action-card";
import type { ItemStatus } from "@/types/general";
import type { AssignedActionWithContext } from "@/types/assigned-actions";

interface KanbanColumnProps {
  status: ItemStatus;
  actions: AssignedActionWithContext[];
  /** Shared callback props forwarded to each card */
  cardProps: KanbanCardCallbacks;
  /** ID of an action that was just moved via drag-and-drop (for highlight) */
  justMovedId?: string;
}

export const KanbanColumn = memo(function KanbanColumn({
  status,
  actions,
  cardProps,
  justMovedId,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-w-[320px] flex-1 rounded-xl border border-border bg-muted/30 transition-colors",
        isOver && "border-primary/50 bg-primary/5"
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span
          className={cn("h-2.5 w-2.5 rounded-full", statusColor(status))}
          aria-hidden
        />
        <h3 className="text-sm font-medium">{actionStatusToString(status)}</h3>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums rounded-full bg-muted px-2 py-0.5">
          {actions.length}
        </span>
      </div>

      {/* Scrollable card area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No actions
          </p>
        ) : (
          actions.map((ctx) => (
            <KanbanActionCard
              key={ctx.action.id}
              ctx={ctx}
              {...cardProps}
              justMoved={ctx.action.id === justMovedId}
            />
          ))
        )}
      </div>
    </div>
  );
});
