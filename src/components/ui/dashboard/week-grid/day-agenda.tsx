import { useId } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DateTime } from "ts-luxon";
import type { GridCard } from "@/lib/week-grid/card";
import type { DayGroup } from "@/lib/week-grid/week";
import type { Option } from "@/types/option";
import { withNowLine } from "./now-line";
import { SessionCard, SessionCardHint, SessionCardLayout, type SessionCardHandlers } from "./session-card";

export interface DayAgendaProps {
  group: DayGroup<GridCard>;
  handlers: SessionCardHandlers;
  now: Option<DateTime>;
  isUnloaded: boolean;
  isLoading: boolean;
}

export function DayAgenda({ group, handlers, now, isUnloaded, isLoading }: DayAgendaProps) {
  const headingId = useId();
  const nodes = isLoading
    ? [<Skeleton key="loading" role="status" aria-label="Loading sessions" className="min-h-14 rounded-xl" />]
    : withNowLine(agendaNodes(group, handlers, isUnloaded), group.items, now);
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
  isUnloaded: boolean
) {
  if (group.items.length === 0) {
    if (isUnloaded) return [];
    return [<NoSessions key="none" />];
  }
  return group.items.map((card) => (
    <SessionCard key={card.session.id} view={card} dimmed={card.dimmed} layout={SessionCardLayout.Agenda} {...handlers} />
  ));
}

// Scheduling on a phone goes through Schedule session in the header.
function NoSessions() {
  return (
    <div className="flex min-h-14 items-center rounded-xl border border-dashed border-border px-4 py-2">
      <p className="text-sm text-muted-foreground">No sessions</p>
    </div>
  );
}
