"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { visibleStatuses, groupByStatus } from "@/components/ui/actions/utils";
import { KanbanColumn } from "@/components/ui/actions/kanban-column";
import { KanbanActionCard } from "@/components/ui/actions/kanban-action-card";
import type { AssignedActionWithContext, StatusVisibility } from "@/types/assigned-actions";
import type { Id, ItemStatus } from "@/types/general";
import type { DateTime } from "ts-luxon";

interface KanbanBoardProps {
  actions: AssignedActionWithContext[];
  visibility: StatusVisibility;
  locale: string;
  onStatusChange: (id: Id, newStatus: ItemStatus) => void;
  onDueDateChange: (id: Id, newDueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  onBodyChange: (id: Id, newBody: string) => void;
  onDelete?: (id: Id) => void;
}

export function KanbanBoard({
  actions,
  visibility,
  locale,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
  onBodyChange,
  onDelete,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const grouped = useMemo(() => groupByStatus(actions), [actions]);
  const columns = visibleStatuses(visibility);

  const activeAction = useMemo(
    () => (activeId ? actions.find((a) => a.action.id === activeId) : undefined),
    [activeId, actions]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);

      const { active, over } = event;
      if (!over) return;

      const actionId = String(active.id);
      const newStatus = String(over.id) as ItemStatus;
      const currentStatus = active.data.current?.status as ItemStatus | undefined;

      if (currentStatus && newStatus !== currentStatus) {
        onStatusChange(actionId, newStatus);
      }
    },
    [onStatusChange]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const cardProps = {
    locale,
    onStatusChange,
    onDueDateChange,
    onAssigneesChange,
    onBodyChange,
    onDelete,
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            actions={grouped[status]}
            cardProps={cardProps}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeAction ? (
          <div className="w-[320px]">
            <KanbanActionCard ctx={activeAction} {...cardProps} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
