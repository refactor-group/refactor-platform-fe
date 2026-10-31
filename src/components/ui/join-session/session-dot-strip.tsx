import { useState } from "react";
import { cn } from "@/components/lib/utils";
import { SessionDot } from "@/components/ui/join-session/session-dot";
import type {
  DotKind,
  MenuSession,
  MonthGroup,
} from "@/components/ui/join-session/types";
import { shortDate } from "@/lib/session-window";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";

interface SessionDotStripProps {
  personName: string;
  groups: MonthGroup[];
  kindOf: (session: MenuSession) => DotKind;
  onSelect: (id: Id) => void;
}

function dotLabel(session: MenuSession): string {
  return `${shortDate(session.start)} · ${session.title}`;
}

function findSession(groups: MonthGroup[], id: Id): Option<MenuSession> {
  const found = groups
    .flatMap((group) => group.sessions)
    .find((session) => session.id === id);
  return found ? Some(found) : None;
}

function DotTooltip({ session }: { session: MenuSession }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-5 right-2.5 whitespace-nowrap rounded-full bg-inverse px-2.5 py-1 text-pill text-inverse-foreground tabular-nums"
    >
      {dotLabel(session)}
    </div>
  );
}

interface MonthGroupDotsProps {
  group: MonthGroup;
  kindOf: (session: MenuSession) => DotKind;
  onSelect: (id: Id) => void;
  onPreview: (id: Id, showing: boolean) => void;
}

function MonthGroupDots({ group, kindOf, onSelect, onPreview }: MonthGroupDotsProps) {
  return (
    <div className="flex items-center">
      <span
        className={cn(
          "py-0.5 pr-1 text-tiny",
          group.selected
            ? "font-semibold text-foreground"
            : "font-medium text-muted-foreground"
        )}
      >
        {group.label}
      </span>
      <div className="flex items-center gap-0.5">
        {group.sessions.map((session) => (
          <SessionDot
            key={session.id}
            kind={kindOf(session)}
            label={dotLabel(session)}
            onSelect={() => onSelect(session.id)}
            onPreview={(showing) => onPreview(session.id, showing)}
          />
        ))}
      </div>
    </div>
  );
}

export function SessionDotStrip({
  personName,
  groups,
  kindOf,
  onSelect,
}: SessionDotStripProps) {
  const [previewing, setPreviewing] = useState<Option<Id>>(None);
  const previewed = previewing.some ? findSession(groups, previewing.val) : None;

  const handlePreview = (id: Id, showing: boolean) =>
    setPreviewing((prev) =>
      showing ? Some(id) : prev.some && prev.val === id ? None : prev
    );

  return (
    <div className="relative flex min-h-7 items-center gap-2.5 px-2.5 pb-2 pt-1.5">
      <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
        {personName}
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        {groups.map((group) => (
          <MonthGroupDots
            key={group.key}
            group={group}
            kindOf={kindOf}
            onSelect={onSelect}
            onPreview={handlePreview}
          />
        ))}
      </div>
      {previewed.some && <DotTooltip session={previewed.val} />}
    </div>
  );
}
