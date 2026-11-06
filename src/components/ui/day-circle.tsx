"use client";

import type { DateTime } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import { formatWeekdayDate } from "@/lib/utils/date";

function dayClasses(selected: boolean, past: boolean): string {
  if (past) return "text-faint";
  if (selected) return "bg-primary text-primary-foreground";
  return "bg-fill text-foreground hover:bg-fill-hover";
}

export interface DayCircleProps {
  day: DateTime;
  past: boolean;
  selected: boolean;
  onSelect: (day: DateTime) => void;
  className?: string;
}

export function DayCircle({ day, past, selected, onSelect, className }: DayCircleProps) {
  return (
    <button
      type="button"
      aria-label={formatWeekdayDate(day)}
      aria-pressed={selected}
      disabled={past}
      onClick={() => onSelect(day)}
      className={cn(
        "flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center rounded-full tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
        dayClasses(selected, past),
        className
      )}
    >
      <span className="text-[10px] leading-tight">{day.toFormat("ccc")}</span>
      <span className="text-[15px] font-medium leading-tight">{day.day}</span>
    </button>
  );
}
