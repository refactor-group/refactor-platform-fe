import type { DateTime } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { CardView } from "@/lib/week-grid/card";
import type { DayGroup } from "@/lib/week-grid/week";
import { type Option, None, Some } from "@/types/option";
import { EmptyDay } from "./empty-day";
import { SessionCard, type SessionCardHandlers } from "./session-card";

export interface DayColumnProps {
  group: DayGroup<CardView>;
  handlers: SessionCardHandlers;
  onSchedule: Option<(day: DateTime) => void>;
  isLoading: boolean;
}

export function DayColumn({ group, handlers, onSchedule, isLoading }: DayColumnProps) {
  return (
    <div
      role="group"
      aria-label={group.day.toFormat("cccc, LLLL d")}
      aria-current={group.isToday ? "date" : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-[14px]",
        group.isToday && "-mx-2 -my-2.5 bg-brand-tint p-2.5"
      )}
    >
      <DayLabel group={group} />
      {isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : group.items.length === 0 ? (
        <EmptyDay day={group.day} isToday={group.isToday} onSchedule={scheduleOn(group, onSchedule)} />
      ) : (
        group.items.map((view) => <SessionCard key={view.session.id} view={view} {...handlers} />)
      )}
    </div>
  );
}

function scheduleOn(
  group: DayGroup<CardView>,
  onSchedule: Option<(day: DateTime) => void>
): Option<() => void> {
  return onSchedule.some && !group.isPast ? Some(() => onSchedule.val(group.day)) : None;
}

function DayLabel({ group }: { group: DayGroup<CardView> }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[13px] tabular-nums",
        group.isToday ? "font-semibold text-foreground" : "font-medium text-muted-foreground/60",
        group.isPast && "opacity-[.55]"
      )}
    >
      <span>{group.day.toFormat("ccc")}</span>
      {group.isToday ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-primary-foreground">
          {group.day.toFormat("d")}
        </span>
      ) : (
        <span>{group.day.toFormat("d")}</span>
      )}
    </div>
  );
}
