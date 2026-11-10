import type { DateTime } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import type { GridCard } from "@/lib/week-grid/card";
import type { DayGroup } from "@/lib/week-grid/week";

export interface DayStripProps {
  days: DayGroup<GridCard>[];
  selected: DateTime;
  onSelect: (day: DateTime) => void;
}

export function DayStrip({ days, selected, onSelect }: DayStripProps) {
  return (
    <div className="mt-6 grid grid-cols-7 gap-2">
      {days.map((group) => (
        <DayPill
          key={group.day.toISODate()}
          group={group}
          isSelected={group.day.hasSame(selected, "day")}
          onSelect={() => onSelect(group.day)}
        />
      ))}
    </div>
  );
}

interface DayPillProps {
  group: DayGroup<GridCard>;
  isSelected: boolean;
  onSelect: () => void;
}

function DayPill({ group, isSelected, onSelect }: DayPillProps) {
  const hasSessions = group.items.length > 0;
  return (
    <button
      type="button"
      aria-label={group.day.toFormat("cccc, LLLL d")}
      aria-pressed={isSelected}
      aria-current={group.isToday ? "date" : undefined}
      data-has-sessions={String(hasSessions)}
      onClick={onSelect}
      className={cn(
        "flex h-11 min-w-0 flex-col items-center justify-center rounded-full tabular-nums outline-none transition-colors duration-150",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        pillTone(group, isSelected)
      )}
    >
      <span className="text-tiny font-medium leading-none">{group.day.toFormat("ccccc")}</span>
      <span className="mt-0.5 text-sm font-semibold leading-tight">{group.day.toFormat("d")}</span>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 h-1 w-1 rounded-full",
          isSelected ? "bg-primary-foreground" : "bg-brand",
          !hasSessions && "invisible"
        )}
      />
    </button>
  );
}

function pillTone(group: DayGroup<GridCard>, isSelected: boolean): string {
  if (isSelected) return "bg-brand text-primary-foreground";
  const fill = group.isToday ? "bg-brand-tint" : "bg-fill hover:bg-fill-hover";
  const text = group.isPast ? "text-muted-foreground" : group.isToday ? "text-brand-strong" : "text-foreground";
  return cn(fill, text);
}
