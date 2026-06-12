"use client";

import type { LucideIcon } from "lucide-react";
import { CalendarClock, Check } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { TopicStatus } from "@/types/coaching-session-topic";

interface StatusButtonProps {
  icon: LucideIcon;
  active: boolean;
  editable: boolean;
  label: string;
  activeClass: string;
  onClick: () => void;
}

// Circular toggle echoing the chips it replaces: muted/dashed when off, tinted
// when on. Either participant may toggle; read-only renders state only.
function StatusButton({
  icon: Icon,
  active,
  editable,
  label,
  activeClass,
  onClick,
}: StatusButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={!editable}
      onClick={editable ? onClick : undefined}
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors",
        editable && "hover:border-foreground/40",
        active
          ? activeClass
          : "border-dashed border-border bg-transparent text-muted-foreground/50",
        !editable && "cursor-default"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export interface TopicStatusControlsProps {
  status: TopicStatus;
  /** Either participant may set status; read-only views pass false. */
  editable: boolean;
  onChange: (next: TopicStatus) => void;
}

export function TopicStatusControls({
  status,
  editable,
  onChange,
}: TopicStatusControlsProps) {
  // Tri-state toggle: clicking the active state returns to Open.
  const toggle = (target: TopicStatus) =>
    onChange(status === target ? TopicStatus.Open : target);

  return (
    <div className="flex items-center gap-1.5">
      <StatusButton
        icon={Check}
        active={status === TopicStatus.Discussed}
        editable={editable}
        label={
          status === TopicStatus.Discussed
            ? "Mark as not discussed"
            : "Mark as discussed"
        }
        activeClass="border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        onClick={() => toggle(TopicStatus.Discussed)}
      />
      <StatusButton
        icon={CalendarClock}
        active={status === TopicStatus.Deferred}
        editable={editable}
        label={
          status === TopicStatus.Deferred
            ? "Undo defer"
            : "Defer to next session"
        }
        activeClass="border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-300"
        onClick={() => toggle(TopicStatus.Deferred)}
      />
    </div>
  );
}
