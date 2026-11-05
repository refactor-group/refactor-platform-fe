import { Plus } from "lucide-react";
import type { DateTime } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import type { Option } from "@/types/option";

export interface EmptyDayProps {
  day: DateTime;
  onSchedule: Option<() => void>;
}

const EMPTY_DAY_CLASS = "h-32 w-full rounded-xl border border-dashed border-border";

export function EmptyDay({ day, onSchedule }: EmptyDayProps) {
  if (onSchedule.none) return <div className={EMPTY_DAY_CLASS} />;
  return (
    <button
      type="button"
      aria-label={`Schedule on ${day.toFormat("cccc, LLLL d")}`}
      onClick={onSchedule.val}
      className={cn(
        EMPTY_DAY_CLASS,
        "group flex items-center justify-center outline-none transition-colors duration-150",
        "hover:border-brand-border hover:bg-brand-tint focus-visible:border-brand-border focus-visible:bg-brand-tint"
      )}
    >
      <span className="flex items-center gap-1 text-xs font-medium text-brand opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Schedule
      </span>
    </button>
  );
}
