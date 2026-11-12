"use client";

import type { LucideIcon } from "lucide-react";
import { CalendarClock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopicStatus } from "@/types/coaching-session-topic";

interface StatusButtonProps {
  icon: LucideIcon;
  active: boolean;
  editable: boolean;
  label: string;
  activeClass: string;
  onClick: () => void;
}

// Same ghost icon button as the row's other actions; a tint marks the active state.
// Either participant may toggle; read-only renders state only.
function StatusButton({
  icon: Icon,
  active,
  editable,
  label,
  activeClass,
  onClick,
}: StatusButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-menu"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={!editable}
      onClick={editable ? onClick : undefined}
      className={active ? activeClass : "text-faint"}
    >
      <Icon aria-hidden />
    </Button>
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
    <div className="flex items-center gap-0.5">
      <StatusButton
        icon={Check}
        active={status === TopicStatus.Discussed}
        editable={editable}
        label={
          status === TopicStatus.Discussed
            ? "Mark as not discussed"
            : "Mark as discussed"
        }
        activeClass="bg-positive-tint text-positive hover:bg-positive-tint disabled:text-positive"
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
        activeClass="bg-brand-tint text-brand-strong hover:bg-brand-tint disabled:text-brand-strong"
        onClick={() => toggle(TopicStatus.Deferred)}
      />
    </div>
  );
}
