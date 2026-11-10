import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import type { DateTime } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import type { Option } from "@/types/option";

export interface EmptyDayProps {
  day: DateTime;
  isToday: boolean;
  onSchedule: Option<() => void>;
}

const EMPTY_DAY_CLASS = "grid h-32 w-full place-items-center rounded-xl border border-dashed border-border";
const STACKED = "[grid-area:1/1] transition-opacity duration-150";

/** A day whose sessions didn't load: neither empty nor schedulable. */
export function UnloadedDay() {
  return <div className={EMPTY_DAY_CLASS} />;
}

export function EmptyDay({ day, isToday, onSchedule }: EmptyDayProps) {
  if (onSchedule.none) return <div className={EMPTY_DAY_CLASS}>{isToday && <NoSessionsToday />}</div>;
  return (
    <ScheduleDayButton
      day={day}
      onSchedule={onSchedule.val}
      className={cn(
        EMPTY_DAY_CLASS,
        "hover:border-brand-border hover:bg-brand-tint focus-visible:border-brand-border focus-visible:bg-brand-tint"
      )}
      labelClassName={cn(STACKED, "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100")}
    >
      {isToday && <NoSessionsToday className="group-hover:opacity-0 group-focus-visible:opacity-0" />}
    </ScheduleDayButton>
  );
}

function NoSessionsToday({ className }: { className?: string }) {
  return <span className={cn(STACKED, "text-xs text-muted-foreground", className)}>No sessions today</span>;
}

export interface ScheduleDayButtonProps {
  day: DateTime;
  onSchedule: () => void;
  className?: string;
  labelClassName?: string;
  children?: ReactNode;
}

export function ScheduleDayButton({ day, onSchedule, className, labelClassName, children }: ScheduleDayButtonProps) {
  return (
    <button
      type="button"
      aria-label={`Schedule on ${day.toFormat("cccc, LLLL d")}`}
      onClick={onSchedule}
      className={cn(
        "group flex items-center justify-center outline-none transition-colors duration-150",
        className
      )}
    >
      {children}
      <span className={cn("flex items-center gap-1 text-xs font-medium text-brand", labelClassName)}>
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Schedule
      </span>
    </button>
  );
}
