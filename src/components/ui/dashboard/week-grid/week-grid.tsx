import type { DateTime } from "ts-luxon";
import type { GridCard } from "@/lib/week-grid/card";
import type { DayGroup } from "@/lib/week-grid/week";
import type { Option } from "@/types/option";
import { DayColumn } from "./day-column";
import { SessionCardHint, type SessionCardHandlers } from "./session-card";

export interface WeekGridProps {
  days: DayGroup<GridCard>[];
  handlers: SessionCardHandlers;
  onSchedule: Option<(day: DateTime) => void>;
  isLoading: boolean;
}

// Columns stack below lg until the mobile day strip lands (plan D13).
const WEEK_GRID_CLASS = "mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-7";

export function WeekGrid({ days, handlers, onSchedule, isLoading }: WeekGridProps) {
  return (
    <SessionCardHint active={days.some((d) => d.items.length > 0)}>
      <div className={WEEK_GRID_CLASS}>
        {days.map((group) => (
          <DayColumn
            key={group.day.toISODate()}
            group={group}
            handlers={handlers}
            onSchedule={onSchedule}
            isLoading={isLoading}
          />
        ))}
      </div>
    </SessionCardHint>
  );
}
