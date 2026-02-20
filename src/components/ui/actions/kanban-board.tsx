"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { visibleStatuses, groupByStatus, buildInitialOrder, sortGroupedActions } from "@/components/ui/actions/utils";
import { KanbanColumn } from "@/components/ui/actions/kanban-column";
import { KanbanActionCard } from "@/components/ui/actions/kanban-action-card";
import type { AssignedActionWithContext, StatusVisibility } from "@/types/assigned-actions";
import { BoardSort } from "@/types/assigned-actions";
import type { Id, ItemStatus } from "@/types/general";
import type { DateTime } from "ts-luxon";

interface KanbanBoardProps {
  actions: AssignedActionWithContext[];
  visibility: StatusVisibility;
  sortField: BoardSort;
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
  sortField,
  locale,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
  onBodyChange,
  onDelete,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | undefined>();
  const [activeWidth, setActiveWidth] = useState<number | undefined>();
  const [justMovedId, setJustMovedId] = useState<string | undefined>();
  const justMovedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Clear the highlight timer on unmount
  useEffect(() => {
    return () => {
      if (justMovedTimer.current) clearTimeout(justMovedTimer.current);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Snapshot initial order so inline edits don't re-sort cards.
  // Rebuilds only when IDs are added or removed (filter/view changes).
  const orderRef = useRef<Map<string, number>>(new Map());

  const currentIds = useMemo(() => actions.map((a) => a.action.id), [actions]);
  const updatedOrder = useMemo(
    () => buildInitialOrder(orderRef.current, currentIds),
    [currentIds]
  );
  if (updatedOrder) {
    orderRef.current = updatedOrder;
  }

  const grouped = useMemo(
    () => sortGroupedActions(groupByStatus(actions), sortField, orderRef.current),
    [actions, sortField]
  );
  const columns = visibleStatuses(visibility);

  const activeAction = useMemo(
    () => (activeId ? actions.find((a) => a.action.id === activeId) : undefined),
    [activeId, actions]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    const el = (event.activatorEvent.target as HTMLElement | null)?.closest<HTMLElement>("[data-kanban-card]");
    if (el) setActiveWidth(el.offsetWidth);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(undefined);

      const { active, over } = event;
      if (!over) return;

      const actionId = String(active.id);
      const newStatus = String(over.id) as ItemStatus;
      const currentStatus = active.data.current?.status as ItemStatus | undefined;

      if (currentStatus && newStatus !== currentStatus) {
        onStatusChange(actionId, newStatus);

        // Brief highlight on the card that just moved
        if (justMovedTimer.current) clearTimeout(justMovedTimer.current);
        setJustMovedId(actionId);
        justMovedTimer.current = setTimeout(() => setJustMovedId(undefined), 1500);
      }
    },
    [onStatusChange]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(undefined);
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
            justMovedId={justMovedId}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeAction ? (
          <div style={activeWidth ? { width: activeWidth } : undefined}>
            <KanbanActionCard ctx={activeAction} {...cardProps} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
