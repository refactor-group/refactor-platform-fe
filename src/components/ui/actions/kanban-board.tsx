"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  MeasuringStrategy,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { visibleStatuses, buildInitialOrder, groupActionsByStatus } from "@/components/ui/actions/utils";
import { useOptimisticStatus } from "@/components/ui/actions/use-optimistic-status";
import { KanbanColumn } from "@/components/ui/actions/kanban-column";
import { KanbanActionCard } from "@/components/ui/actions/kanban-action-card";
import { actionStatusToString } from "@/types/general";
import { StatusVisibility } from "@/types/assigned-actions";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import type { Id, ItemStatus } from "@/types/general";
import type { DateTime } from "ts-luxon";

/** Position value that sorts before all natural positions (0, 1, 2…) */
const TOP_OF_COLUMN_POSITION = -1;

/** Duration of the card exit animation in ms (matches CSS keyframe) */
const EXIT_ANIMATION_MS = 350;

/** Duration of the card enter animation in ms (matches CSS keyframe) */
const ENTER_ANIMATION_MS = 350;

/** Delay (ms) for React to flush the visibility change before highlighting a card */
const HIGHLIGHT_SETTLE_MS = 50;

/**
 * Measure droppable rects BEFORE dragging (while idle) and cache them.
 * The default `WhileDragging` strategy forces synchronous layout reflows
 * via getBoundingClientRect() at drag-start and on every column crossing,
 * which blocks the main thread proportionally to the total DOM node count.
 * Columns don't resize during drag, so pre-measured positions stay accurate.
 */
const measuringConfig = {
  droppable: { strategy: MeasuringStrategy.BeforeDragging },
};

interface ExitingCard {
  originalStatus: ItemStatus;
  newStatus: ItemStatus;
}

interface KanbanBoardProps {
  actions: AssignedActionWithContext[];
  visibility: StatusVisibility;
  locale: string;
  onStatusChange: (id: Id, newStatus: ItemStatus) => Promise<void>;
  onVisibilityChange: (vis: StatusVisibility) => void;
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
  onVisibilityChange,
  onDueDateChange,
  onAssigneesChange,
  onBodyChange,
  onDelete,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | undefined>();
  const [justMovedId, setJustMovedId] = useState<string | undefined>();
  const justMovedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Pre-cached card width so we never force a synchronous layout reflow at drag-start */
  const [cachedCardWidth, setCachedCardWidth] = useState<number | undefined>();

  /** Cards currently playing the exit animation before leaving the visible columns */
  const [exitingCards, setExitingCards] = useState<Map<string, ExitingCard>>(
    () => new Map()
  );
  const exitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  /** Timer for the Show button's delayed highlight (tracked for unmount cleanup) */
  const showHighlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** Cards currently playing the enter (grow-in) animation after being restored via Undo */
  const [enteringIds, setEnteringIds] = useState<Set<string>>(() => new Set());
  const enterTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const { actionsWithOverrides, applyOverride, rollbackOverride } =
    useOptimisticStatus(actions);

  // Clear timers on unmount
  useEffect(() => {
    const exitMap = exitTimers.current;
    const enterMap = enterTimers.current;
    return () => {
      if (justMovedTimer.current) clearTimeout(justMovedTimer.current);
      if (showHighlightTimer.current) clearTimeout(showHighlightTimer.current);
      for (const timer of exitMap.values()) clearTimeout(timer);
      for (const timer of enterMap.values()) clearTimeout(timer);
    };
  }, []);

  // Cache card width once (idle-time measurement, never during drag)
  useEffect(() => {
    const el = document.querySelector("[data-kanban-card]") as HTMLElement | null;
    if (el) {
      const w = el.offsetWidth;
      setCachedCardWidth((prev) => (prev === w ? prev : w));
    }
  }, [actions]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
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
    () => groupActionsByStatus(actionsWithOverrides).preservingOrder(orderRef.current),
    [actionsWithOverrides]
  );
  const columns = visibleStatuses(visibility);

  // Build per-column exiting ID sets so only the affected column re-renders.
  // Columns without exiting cards receive `undefined` (referentially stable),
  // preserving the memo optimization on KanbanColumn.
  const exitingIdsByColumn = useMemo(() => {
    if (exitingCards.size === 0) return undefined;
    const map = new Map<ItemStatus, Set<string>>();
    for (const [id, entry] of exitingCards) {
      let set = map.get(entry.originalStatus);
      if (!set) {
        set = new Set();
        map.set(entry.originalStatus, set);
      }
      set.add(id);
    }
    return map;
  }, [exitingCards]);

  const activeAction = useMemo(
    () => (activeId ? actionsWithOverrides.find((a) => a.action.id === activeId) : undefined),
    [activeId, actionsWithOverrides]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const highlightCard = useCallback((id: string) => {
    if (justMovedTimer.current) clearTimeout(justMovedTimer.current);
    setJustMovedId(id);
    justMovedTimer.current = setTimeout(() => setJustMovedId(undefined), 1500);
  }, []);

  /** Play the grow-in entry animation on a card, then auto-clear after it finishes */
  const animateEnter = useCallback((id: string) => {
    setEnteringIds((prev) => new Set(prev).add(id));
    const timer = setTimeout(() => {
      setEnteringIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      enterTimers.current.delete(id);
    }, ENTER_ANIMATION_MS);
    enterTimers.current.set(id, timer);
  }, []);

  /** Complete the exit: apply the optimistic override and show a toast */
  const completeExit = useCallback(
    (id: string, entry: ExitingCard) => {
      // Clean up timer reference
      exitTimers.current.delete(id);
      setExitingCards((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });

      // Now apply the override so the card leaves the visible column
      applyOverride(id, entry.newStatus);
      orderRef.current.set(id, TOP_OF_COLUMN_POSITION);

      const statusLabel = actionStatusToString(entry.newStatus);
      toast(`Moved to ${statusLabel}`, {
        action: {
          label: "Show",
          onClick: () => {
            onVisibilityChange(StatusVisibility.All);
            // Delay highlight so React can flush the All-view render first
            showHighlightTimer.current = setTimeout(
              () => highlightCard(id),
              HIGHLIGHT_SETTLE_MS
            );
          },
        },
        cancel: {
          label: "Undo",
          onClick: () => {
            // Revert: apply override back to original status and persist via API
            applyOverride(id, entry.originalStatus);
            orderRef.current.set(id, TOP_OF_COLUMN_POSITION);
            animateEnter(id);
            highlightCard(id);
            onStatusChange(id, entry.originalStatus).catch(() => {
              rollbackOverride(id);
              toast.error("Undo failed, could not restore action status.");
            });
          },
        },
        duration: 5000,
      });
    },
    [applyOverride, rollbackOverride, onStatusChange, onVisibilityChange, highlightCard, animateEnter]
  );

  const cancelExit = useCallback((id: string) => {
    setExitingCards((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    const timer = exitTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      exitTimers.current.delete(id);
    }
  }, []);

  /** Card moves to a non-visible column: animate out, persist, then show toast */
  const handleExitingStatusChange = useCallback(
    async (id: Id, newStatus: ItemStatus) => {
      // Read from raw `actions` (not actionsWithOverrides) so we capture the
      // server-persisted status — not a stale optimistic override.
      const action = actions.find((a) => a.action.id === id);
      if (!action) return;

      const entry: ExitingCard = {
        originalStatus: action.action.status,
        newStatus,
      };

      // Start exit animation — card stays in its current column but fades out
      setExitingCards((prev) => new Map(prev).set(id, entry));

      // Fire API call immediately (don't wait for animation)
      try {
        await onStatusChange(id, newStatus);
      } catch {
        cancelExit(id);
        return;
      }

      // Schedule visual removal + toast after animation completes
      const timer = setTimeout(() => completeExit(id, entry), EXIT_ANIMATION_MS);
      exitTimers.current.set(id, timer);
    },
    [actions, onStatusChange, cancelExit, completeExit]
  );

  /** Card stays in a visible column: move instantly with highlight */
  const handleVisibleStatusChange = useCallback(
    async (id: Id, newStatus: ItemStatus) => {
      applyOverride(id, newStatus);
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

  const handleOptimisticStatusChange = useCallback(
    async (id: Id, newStatus: ItemStatus) => {
      const leavesView = !visibleStatuses(visibility).includes(newStatus);
      if (leavesView) {
        await handleExitingStatusChange(id, newStatus);
      } else {
        await handleVisibleStatusChange(id, newStatus);
      }
    },
    [visibility, handleExitingStatusChange, handleVisibleStatusChange]
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

  const cardProps = useMemo(
    () => ({
      locale,
      onStatusChange: handleOptimisticStatusChange,
      onDueDateChange,
      onAssigneesChange,
      onBodyChange,
      onDelete,
    }),
    [locale, handleOptimisticStatusChange, onDueDateChange, onAssigneesChange, onBodyChange, onDelete]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      measuring={measuringConfig}
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
            exitingIds={exitingIdsByColumn?.get(status)}
            enteringIds={enteringIds.size > 0 ? enteringIds : undefined}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeAction ? (
          <div style={cachedCardWidth ? { width: cachedCardWidth } : undefined}>
            <KanbanActionCard ctx={activeAction} {...cardProps} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
