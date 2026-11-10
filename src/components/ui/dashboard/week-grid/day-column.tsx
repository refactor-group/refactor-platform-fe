import type { RefObject } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { DateTime } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { GridCard } from "@/lib/week-grid/card";
import type { DaySlot, DropTarget } from "@/lib/week-grid/slots";
import { scheduleOn, type DayGroup } from "@/lib/week-grid/week";
import { type Option, Some } from "@/types/option";
import { DropSlots } from "./drop-slots";
import { EmptyDay, UnloadedDay } from "./empty-day";
import { withNowLine } from "./now-line";
import { SessionCard, type SessionCardHandlers } from "./session-card";

/** How a column looks while a card is dragged. */
export type ColumnDrag =
  | { kind: "idle" }
  | { kind: "open" }
  | { kind: "over"; slots: DaySlot[]; hovered: Option<DateTime>; name: string };

export interface DayColumnProps {
  group: DayGroup<GridCard>;
  handlers: SessionCardHandlers;
  onSchedule: Option<(day: DateTime) => void>;
  drag: ColumnDrag;
  justDragged: RefObject<boolean>;
  now: Option<DateTime>;
  isLoading: boolean;
  isUnloaded: boolean;
}

export function DayColumn({ group, handlers, onSchedule, drag, justDragged, now, isLoading, isUnloaded }: DayColumnProps) {
  const { setNodeRef } = useDroppable({
    id: `day:${group.day.toISODate()}`,
    data: { kind: "day", day: group.day } satisfies DropTarget,
    disabled: group.isPast,
  });
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={group.day.toFormat("cccc, LLLL d")}
      aria-current={group.isToday ? "date" : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-[14px]",
        group.isToday && "-mx-2 -my-2.5 bg-brand-tint p-2.5",
        drag.kind !== "idle" && !group.isToday && "-mx-1.5 -my-1.5 p-1.5",
        drag.kind === "open" && "bg-well",
        drag.kind === "over" && "bg-card shadow-[0_8px_24px_rgba(0,0,0,.08)]"
      )}
    >
      <DayLabel group={group} />
      <DayBody
        group={group}
        handlers={handlers}
        onSchedule={onSchedule}
        drag={drag}
        justDragged={justDragged}
        now={now}
        isLoading={isLoading}
        isUnloaded={isUnloaded}
      />
    </div>
  );
}

function DayBody({ group, handlers, onSchedule, drag, justDragged, now, isLoading, isUnloaded }: DayColumnProps) {
  if (isLoading) return <Skeleton className="h-32 rounded-xl" />;
  if (drag.kind === "over") return <DropSlots slots={drag.slots} hovered={drag.hovered} name={drag.name} />;
  const nodes =
    group.items.length === 0
      ? [
          isUnloaded ? (
            <UnloadedDay key="empty" />
          ) : (
            <EmptyDay
              key="empty"
              day={group.day}
              isToday={group.isToday}
              onSchedule={scheduleOn(group, onSchedule)}
            />
          ),
        ]
      : group.items.map((card) => (
          <SessionCard
            key={card.session.id}
            view={card}
            dimmed={card.dimmed}
            justDragged={Some(justDragged)}
            {...handlers}
          />
        ));
  return withNowLine(nodes, group.items, now);
}

function DayLabel({ group }: { group: DayGroup<GridCard> }) {
  return (
    <div
      className={cn(
        "flex h-5 items-center gap-1.5 text-[12.5px] tabular-nums",
        group.isToday ? "font-semibold text-foreground" : "font-medium text-muted-foreground/60",
        group.isPast && "opacity-[.55]"
      )}
    >
      <span>{group.day.toFormat("ccc")}</span>
      {group.isToday ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-[5px] text-[11px] font-semibold text-primary-foreground">
          {group.day.toFormat("d")}
        </span>
      ) : (
        <span>{group.day.toFormat("d")}</span>
      )}
    </div>
  );
}
