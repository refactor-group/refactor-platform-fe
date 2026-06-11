"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/components/lib/utils";
import { TopicPriority } from "@/types/coaching-session-topic";
import { type Option, Some, None } from "@/types/option";

// Sentinel for the "clear" row — Radix Select item values can't be empty.
const CLEAR = "__clear__";

const LEVELS: { value: TopicPriority; label: string; dot: string; text: string }[] = [
  { value: TopicPriority.Low, label: "Low", dot: "bg-slate-400", text: "text-slate-600 dark:text-slate-300" },
  { value: TopicPriority.Medium, label: "Medium", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
  { value: TopicPriority.High, label: "High", dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-300" },
];

const levelOf = (p: Option<TopicPriority>) =>
  p.some ? LEVELS.find((l) => l.value === p.val) : undefined;

export interface TopicPrioritySelectProps {
  priority: Option<TopicPriority>;
  /** Only the coachee may set priority; otherwise the control is read-only. */
  editable: boolean;
  onChange: (next: Option<TopicPriority>) => void;
}

export function TopicPrioritySelect({
  priority,
  editable,
  onChange,
}: TopicPrioritySelectProps) {
  const current = levelOf(priority);

  // Read-only (coach): a static chip — never the dropdown affordance, so it
  // can't imply the priority is settable. Unset shows an explicit muted label.
  if (!editable) {
    if (!current) {
      return (
        <span
          aria-label="Priority: not set"
          className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] text-muted-foreground/50"
        >
          <span className="h-1.5 w-1.5 rounded-full border border-muted-foreground/40" />
          Priority Not Set
        </span>
      );
    }
    return (
      <span
        aria-label={`Priority: ${current.label}`}
        className={cn(
          "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px]",
          current.text
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", current.dot)} />
        {current.label}
      </span>
    );
  }

  return (
    <Select
      value={priority.some ? priority.val : ""}
      onValueChange={(v) =>
        onChange(v === CLEAR ? None : Some(v as TopicPriority))
      }
    >
      <SelectTrigger
        aria-label="Priority"
        className="h-6 w-auto gap-1.5 rounded-full px-2.5 text-[11px] [&>svg]:h-3 [&>svg]:w-3"
      >
        {current ? (
          <span className={cn("inline-flex items-center gap-1.5", current.text)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", current.dot)} />
            {current.label}
          </span>
        ) : (
          <SelectValue placeholder="Priority" />
        )}
      </SelectTrigger>
      <SelectContent>
        {LEVELS.map(({ value, label, dot }) => (
          <SelectItem key={value} value={value} className="text-[13px]">
            <span className="inline-flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", dot)} />
              {label}
            </span>
          </SelectItem>
        ))}
        {priority.some && (
          <>
            <SelectSeparator />
            <SelectItem value={CLEAR} className="text-[13px] text-muted-foreground">
              Clear
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
