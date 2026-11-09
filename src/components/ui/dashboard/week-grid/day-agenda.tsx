import { useId } from "react";
import type { DateTime } from "ts-luxon";
import type { GridCard } from "@/lib/week-grid/card";
import { scheduleOn, type DayGroup } from "@/lib/week-grid/week";
import type { Option } from "@/types/option";
import { ScheduleDayButton } from "./empty-day";
import { withNowLine } from "./now-line";
import { SessionCard, SessionCardHint, SessionCardLayout, type SessionCardHandlers } from "./session-card";

export interface DayAgendaProps {
  group: DayGroup<GridCard>;
  handlers: SessionCardHandlers;
  onSchedule: Option<(day: DateTime) => void>;
  now: Option<DateTime>;
}

export function DayAgenda({ group, handlers, onSchedule, now }: DayAgendaProps) {
  const headingId = useId();
  const nodes = withNowLine(agendaNodes(group, handlers, onSchedule), group.items, now);
  return (
    <section aria-labelledby={headingId} className="mt-6 flex flex-col gap-2.5">
      <h3 id={headingId} className="text-sm font-semibold text-foreground">
        {group.day.toFormat("cccc, LLLL d")}
      </h3>
      {group.items.length > 0 ? <SessionCardHint>{nodes}</SessionCardHint> : nodes}
    </section>
  );
}

function agendaNodes(
  group: DayGroup<GridCard>,
  handlers: SessionCardHandlers,
  onSchedule: Option<(day: DateTime) => void>
) {
  if (group.items.length === 0) {
    return [<NoSessions key="none" day={group.day} onSchedule={scheduleOn(group, onSchedule)} />];
  }
  return group.items.map((card) => (
    <SessionCard key={card.session.id} view={card} dimmed={card.dimmed} layout={SessionCardLayout.Agenda} {...handlers} />
  ));
}

function NoSessions({ day, onSchedule }: { day: DateTime; onSchedule: Option<() => void> }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-2">
      <p className="text-sm text-muted-foreground">No sessions</p>
      {onSchedule.some && (
        <ScheduleDayButton
          day={day}
          onSchedule={onSchedule.val}
          className="h-9 rounded-full px-3.5 hover:bg-brand-tint focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}
    </div>
  );
}
