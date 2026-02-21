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
import { visibleStatuses, groupByStatus, buildInitialOrder, sortGroupedByInitialOrder } from "@/components/ui/actions/utils";
import { useOptimisticStatus } from "@/components/ui/actions/use-optimistic-status";
import { KanbanColumn } from "@/components/ui/actions/kanban-column";
import { KanbanActionCard } from "@/components/ui/actions/kanban-action-card";
import type { AssignedActionWithContext, StatusVisibility } from "@/types/assigned-actions";
import type { Id, ItemStatus } from "@/types/general";
import type { DateTime } from "ts-luxon";

/** Position value that sorts before all natural positions (0, 1, 2…) */
const TOP_OF_COLUMN_POSITION = -1;

interface KanbanBoardProps {
  actions: AssignedActionWithContext[];
  visibility: StatusVisibility;
  locale: string;
  onStatusChange: (id: Id, newStatus: ItemStatus) => Promise<void>;
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
  const [activeId, setActiveId] = useState<string | undefined>();
  const [activeWidth, setActiveWidth] = useState<number | undefined>();
  const [justMovedId, setJustMovedId] = useState<string | undefined>();
  const justMovedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { actionsWithOverrides, applyOverride, rollbackOverride } =
    useOptimisticStatus(actions);

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
    () => sortGroupedByInitialOrder(groupByStatus(actionsWithOverrides), orderRef.current),
    [actionsWithOverrides]
  );
  const columns = visibleStatuses(visibility);

  const activeAction = useMemo(
    () => (activeId ? actionsWithOverrides.find((a) => a.action.id === activeId) : undefined),
    [activeId, actionsWithOverrides]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    const el = (event.activatorEvent.target as HTMLElement | null)?.closest<HTMLElement>("[data-kanban-card]");
    if (el) setActiveWidth(el.offsetWidth);
  }, []);

  const highlightCard = useCallback((id: string) => {
    if (justMovedTimer.current) clearTimeout(justMovedTimer.current);
    setJustMovedId(id);
    justMovedTimer.current = setTimeout(() => setJustMovedId(undefined), 1500);
  }, []);

  /** Optimistic status change: move card immediately, highlight it, roll back on failure */
  const handleOptimisticStatusChange = useCallback(
    async (id: Id, newStatus: ItemStatus) => {
      applyOverride(id, newStatus);
      // Place the moved card at the top of its new column
      orderRef.current.set(id, TOP_OF_COLUMN_POSITION);
      highlightCard(id);
      try {
        await onStatusChange(id, newStatus);
      } catch {
        rollbackOverride(id);
      }
    },
    [onStatusChange, applyOverride, rollbackOverride, highlightCard]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(undefined);

      const { active, over } = event;
      if (!over) return;

      const actionId = String(active.id);
      const newStatus = String(over.id) as ItemStatus;
      const currentStatus = active.data.current?.status as ItemStatus | undefined;

      if (currentStatus && newStatus !== currentStatus) {
        handleOptimisticStatusChange(actionId, newStatus);
      }
    },
    [handleOptimisticStatusChange]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(undefined);
  }, []);

  const cardProps = {
    locale,
    onStatusChange: handleOptimisticStatusChange,
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
