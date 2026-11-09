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
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import type { DateTime } from "ts-luxon";
import { firstNameOf } from "@/lib/scheduling-copy";
import type { CardView, GridCard } from "@/lib/week-grid/card";
import { CANCELLED_LINE, droppedLine, overAnnouncement, pickedUpLine } from "@/lib/week-grid/drag-announcements";
import { settledOutcome, targetOutcome, type DaySlot, type DropOutcome, type DropTarget } from "@/lib/week-grid/slots";
import { nowLineOn, type DayGroup } from "@/lib/week-grid/week";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { type Option, None, Some } from "@/types/option";
import { DayColumn, type ColumnDrag } from "./day-column";
import { DragGhost } from "./drag-ghost";
import { SessionCardHint, type SessionCardHandlers } from "./session-card";

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
  now: DateTime;
  isLoading: boolean;
  isUnloaded: boolean;
}

const WEEK_GRID_CLASS = "mt-6 grid grid-cols-7 items-start gap-4";

// Enter stays the card's open key, so only Space picks up and drops.
const KEYBOARD_CODES = { start: [KeyboardCode.Space], cancel: [KeyboardCode.Esc], end: [KeyboardCode.Space] };

const SCREEN_READER_INSTRUCTIONS = {
  draggable: "To move a session, press Space, use the arrow keys to pick a time, then press Space to drop or Escape to cancel.",
};

// Only near the top or bottom edge, so picking up a low card doesn't scroll the page away.
const AUTO_SCROLL = { threshold: { x: 0, y: 0.1 } };

// The keyboard has no pointer, so it falls back to the dragged rect.
const collision: CollisionDetection = (args) => (args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args));

export function WeekGrid({ days, handlers, onSchedule, drag, now, isLoading, isUnloaded }: WeekGridProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { keyboardCodes: KEYBOARD_CODES })
  );
  const [dragged, setDragged] = useState<Option<GridCard>>(None);
  const [over, setOver] = useState<Option<DropTarget>>(None);
  const justDragged = useRef(false);
  const [speech] = useState(createDragSpeech);

  const onDragStart = ({ active }: DragStartEvent) => {
    const card = cardWith(days, active.id);
    speech.pickUp(card);
    setDragged(card);
    justDragged.current = true;
  };
  const onDragMove = ({ delta }: DragMoveEvent) => speech.move(delta);
  const onDragOver = (event: DragOverEvent) => setOver(dropTargetOf(event.over));
  const endDrag = () => {
    setDragged(None);
    setOver(None);
    // Outlives the drop's trailing click, then lets the next real click through.
    setTimeout(() => {
      justDragged.current = false;
    });
  };
  const onDragEnd = ({ over: target, delta }: DragEndEvent) => {
    const outcome = settledOutcome(targetOutcome(dropTargetOf(target)), delta);
    speech.drop(outcome);
    if (dragged.some) dropOn(dragged.val, outcome, drag);
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
    <SessionCardHint>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        accessibility={{ screenReaderInstructions: SCREEN_READER_INSTRUCTIONS, announcements: speech.announcements }}
        autoScroll={AUTO_SCROLL}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
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
              now={nowLineOn(group, now)}
              isLoading={isLoading}
              isUnloaded={isUnloaded}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragged.some ? <DragGhost view={dragged.val} hovered={hovered} /> : null}
        </DragOverlay>
      </DndContext>
    </SessionCardHint>
  );
}

const IDLE: ColumnDrag = { kind: "idle" };
const OPEN: ColumnDrag = { kind: "open" };

function cardWith(days: DayGroup<GridCard>[], id: UniqueIdentifier): Option<GridCard> {
  const card = days.flatMap((d) => d.items).find((c) => c.session.id === id);
  return card ? Some(card) : None;
}

interface DragSpeech {
  pickUp: (card: Option<CardView>) => void;
  move: (delta: { x: number; y: number }) => void;
  drop: (outcome: DropOutcome) => void;
  announcements: Announcements;
}

// dnd-kit calls the grid's handlers before announcing. The pick-up line rides on every over until
// the card first moves, since picking it up unfolds its own day and fires two overs at once.
function createDragSpeech(): DragSpeech {
  let pickup: Option<string> = None;
  let dropped: DropOutcome = { kind: "ignore" };
  return {
    pickUp: (card) => {
      pickup = card.some ? Some(pickedUpLine(card.val)) : None;
    },
    move: (delta) => {
      if (delta.x !== 0 || delta.y !== 0) pickup = None;
    },
    drop: (outcome) => {
      dropped = outcome;
    },
    announcements: {
      onDragStart: () => (pickup.some ? pickup.val : undefined),
      onDragOver: ({ over }) => {
        const line = overAnnouncement(pickup, dropTargetOf(over));
        return line.some ? line.val : undefined;
      },
      onDragEnd: () => droppedLine(dropped),
      onDragCancel: () => CANCELLED_LINE,
    },
  };
}

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

function dropOn(view: CardView, outcome: DropOutcome, drag: GridDrag) {
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
