"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardCode,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from "@dnd-kit/core";
import type { DateTime } from "ts-luxon";
import { firstNameOf } from "@/lib/scheduling-copy";
import type { CardView, GridCard } from "@/lib/week-grid/card";
import { dropOutcome, type DaySlot } from "@/lib/week-grid/slots";
import type { DayGroup } from "@/lib/week-grid/week";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { type Option, None, Some } from "@/types/option";
import { DayColumn, type ColumnDrag } from "./day-column";
import { DragGhost } from "./drag-ghost";
import type { DropTarget } from "./drop-slots";
import type { SessionCardHandlers } from "./session-card";

export interface GridDrag {
  slotsFor: (session: EnrichedCoachingSession) => (day: DateTime) => DaySlot[];
  onMove: (view: CardView, to: DateTime) => void;
  onResolve: (view: CardView, to: DateTime) => void;
}

export interface WeekGridProps {
  days: DayGroup<GridCard>[];
  handlers: SessionCardHandlers;
  onSchedule: Option<(day: DateTime) => void>;
  drag: GridDrag;
}

export const WEEK_GRID_CLASS = "mt-6 grid grid-cols-7 items-start gap-4";

// Enter stays the card's open key, so only Space picks up and drops.
const KEYBOARD_CODES = { start: [KeyboardCode.Space], cancel: [KeyboardCode.Esc], end: [KeyboardCode.Space] };

const ACCESSIBILITY = {
  screenReaderInstructions: {
    draggable: "To move a session, press Space, use the arrow keys to pick a time, then press Space to drop or Escape to cancel.",
  },
};

// Only near the top or bottom edge, so picking up a low card doesn't scroll the page away.
const AUTO_SCROLL = { threshold: { x: 0, y: 0.1 } };

// The keyboard has no pointer, so it falls back to the dragged rect.
const collision: CollisionDetection = (args) => (args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args));

export function WeekGrid({ days, handlers, onSchedule, drag }: WeekGridProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { keyboardCodes: KEYBOARD_CODES })
  );
  const [dragged, setDragged] = useState<Option<GridCard>>(None);
  const [over, setOver] = useState<Option<DropTarget>>(None);
  const justDragged = useRef(false);

  const onDragStart = ({ active }: DragStartEvent) => {
    const card = days.flatMap((d) => d.items).find((c) => c.session.id === active.id);
    setDragged(card ? Some(card) : None);
    justDragged.current = true;
  };
  const onDragOver = (event: DragOverEvent) => setOver(dropTargetOf(event.over));
  const endDrag = () => {
    setDragged(None);
    setOver(None);
    // Outlives the drop's trailing click, then lets the next real click through.
    setTimeout(() => {
      justDragged.current = false;
    });
  };
  const onDragEnd = ({ over: target }: DragEndEvent) => {
    const dropped = dropTargetOf(target);
    if (dragged.some && dropped.some && dropped.val.kind === "slot") dropOn(dragged.val, dropped.val.slot, drag);
    endDrag();
  };

  const hovered = hoveredSlot(over);
  const columnDrag = (group: DayGroup<GridCard>): ColumnDrag => {
    if (dragged.none || group.isPast) return IDLE;
    const day = overDay(over);
    if (day.none || !day.val.hasSame(group.day, "day")) return OPEN;
    const slots = drag.slotsFor(dragged.val.session)(group.day);
    return { kind: "over", slots, hovered, name: firstNameOf(dragged.val.name) };
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      accessibility={ACCESSIBILITY}
      autoScroll={AUTO_SCROLL}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
    >
      <div className={WEEK_GRID_CLASS}>
        {days.map((group) => (
          <DayColumn
            key={group.day.toISODate()}
            group={group}
            handlers={handlers}
            onSchedule={onSchedule}
            drag={columnDrag(group)}
            justDragged={justDragged}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragged.some ? <DragGhost view={dragged.val} hovered={hovered} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

const IDLE: ColumnDrag = { kind: "idle" };
const OPEN: ColumnDrag = { kind: "open" };

function dropTargetOf(over: Over | null): Option<DropTarget> {
  const data = over?.data.current as DropTarget | undefined;
  return data ? Some(data) : None;
}

function overDay(over: Option<DropTarget>): Option<DateTime> {
  if (over.none) return None;
  return Some(over.val.kind === "day" ? over.val.day : over.val.slot.start);
}

function hoveredSlot(over: Option<DropTarget>): Option<DateTime> {
  return over.some && over.val.kind === "slot" ? Some(over.val.slot.start) : None;
}

function dropOn(view: CardView, slot: DaySlot, drag: GridDrag) {
  const outcome = dropOutcome(slot);
  switch (outcome.kind) {
    case "move":
      drag.onMove(view, outcome.start);
      return;
    case "resolve":
      drag.onResolve(view, outcome.start);
      return;
    case "ignore":
      return;
    default: {
      const _exhaustive: never = outcome;
      throw new Error(`Unhandled drop outcome: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
