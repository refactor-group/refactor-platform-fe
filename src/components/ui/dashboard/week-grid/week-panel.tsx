"use client";

import { useId, useMemo } from "react";
import { DateTime } from "ts-luxon";
import { Button } from "@/components/ui/button";
import { SessionActionDialogs } from "@/components/ui/dashboard/session-action-dialogs";
import { useSessionActions } from "@/components/ui/dashboard/use-session-actions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useWeekGridStore } from "@/lib/providers/week-grid-store-provider";
import { useNow } from "@/lib/hooks/use-now";
import { useScheduleTimezone } from "@/lib/hooks/use-schedule-data";
import { useRefreshCoachingSessions } from "@/lib/hooks/use-sse-cache-invalidation";
import { useWeekEdges } from "@/lib/hooks/use-week-edges";
import { useWeekFilter } from "@/lib/hooks/use-week-filter";
import { useWeekSessions } from "@/lib/hooks/use-week-sessions";
import { SessionAction } from "@/lib/session-actions";
import type { MoveScope } from "@/lib/scheduling";
import { cardView, type GridCard } from "@/lib/week-grid/card";
import { isFilteredOut } from "@/lib/week-grid/filter";
import {
  groupByDay,
  weekOf,
  weekRange,
  weekSubline,
  weekTitle,
  type DayGroup,
  type Week,
} from "@/lib/week-grid/week";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { type Option, None, Some } from "@/types/option";
import type { SessionCardHandlers } from "./session-card";
import { WeekGrid } from "./week-grid";
import { WeekPanelHeader, type WeekNavigation } from "./week-panel-header";

export interface WeekPanelProps {
  onReschedule: (session: EnrichedCoachingSession, scope?: MoveScope) => void;
  onSeriesMutated: () => void;
  onSchedule: (date: Option<DateTime>) => void;
}

const CURRENT_WEEK = 0;

// Keyed on the local date so the fetch key holds steady across clock ticks.
function useWeekAt(offset: number, now: DateTime, timezone: string): Week {
  const today = now.setZone(timezone).startOf("day").toMillis();
  return useMemo(
    () => weekOf(offset, DateTime.fromMillis(today, { zone: timezone }), timezone),
    [offset, today, timezone]
  );
}

function useWeekNavigation(isCurrentWeek: boolean, canSchedule: boolean, week: Week): WeekNavigation {
  const { previousWeek, nextWeek, thisWeek } = useWeekGridStore((s) => s);
  const { hasEarlier, hasLater } = useWeekEdges(week);
  return {
    canGoEarlier: hasEarlier,
    // A coach can always page ahead to schedule into an empty week.
    canGoLater: canSchedule || hasLater,
    isCurrentWeek,
    onPrevious: previousWeek,
    onNext: nextWeek,
    onThisWeek: thisWeek,
  };
}

export function WeekPanel({ onReschedule, onSeriesMutated, onSchedule }: WeekPanelProps) {
  const timezone = useScheduleTimezone();
  const now = useNow(30_000);
  const weekOffset = useWeekGridStore((s) => s.weekOffset);
  const week = useWeekAt(weekOffset, now, timezone);
  const isCurrentWeek = weekOffset === CURRENT_WEEK;
  const canSchedule = useAuthStore((s) => s.isACoach);
  const navigation = useWeekNavigation(isCurrentWeek, canSchedule, week);
  const { sessions, isLoading, isError, refresh } = useWeekSessions(week);
  const viewerId = useAuthStore((s) => s.userId);
  const filter = useWeekFilter();
  const { selected } = filter;

  const onSessionsChanged = useRefreshCoachingSessions();
  const actions = useSessionActions({
    userTimezone: timezone,
    onReschedule,
    onSessionsChanged,
    onSeriesMutated,
  });

  const { run } = actions;
  const handlers = useMemo<SessionCardHandlers>(
    () => ({
      onAction: run,
      onOpen: (view) => run(SessionAction.OpenSession, view.session),
    }),
    [run]
  );

  const days = useMemo(() => {
    const cards = sessions.map((s): GridCard => ({
      ...cardView(s, { viewerId, now, timezone }),
      dimmed: isFilteredOut(s, selected),
    }));
    return groupByDay(cards, (c) => c.start, week, now);
  }, [sessions, viewerId, now, timezone, week, selected]);

  const titleId = useId();
  const header = {
    titleId,
    title: weekTitle(weekOffset, week),
    range: weekRange(week),
    navigation,
    filter: canSchedule
      ? Some({ people: filter.people, selected, onSelect: filter.select, onClear: filter.clear })
      : None,
    onSchedule: canSchedule ? Some(() => onSchedule(None)) : None,
  };
  const scheduleDay = canSchedule ? Some((day: DateTime) => onSchedule(Some(day))) : None;

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={isLoading}
      className="rounded-card border bg-card p-7"
    >
      {isLoading ? (
        <>
          <WeekPanelHeader {...header} subline={None} />
          <WeekGrid days={days} handlers={handlers} onSchedule={scheduleDay} isLoading />
        </>
      ) : isError ? (
        <>
          <WeekPanelHeader {...header} subline={None} />
          <WeekPanelError onRetry={refresh} />
        </>
      ) : (
        <>
          <WeekPanelHeader {...header} subline={Some(sublineFor(days, isCurrentWeek))} />
          <div className="relative">
            <WeekGrid days={days} handlers={handlers} onSchedule={scheduleDay} isLoading={false} />
            {selected.some && visibleCount(days) === 0 && <NoMatches />}
          </div>
        </>
      )}
      <SessionActionDialogs {...actions.dialogs} />
    </section>
  );
}

const visible = (cards: GridCard[]) => cards.filter((c) => !c.dimmed).length;

function visibleCount(days: DayGroup<GridCard>[]): number {
  return days.reduce((sum, d) => sum + visible(d.items), 0);
}

function sublineFor(days: DayGroup<GridCard>[], isCurrentWeek: boolean): string {
  const today = visible(days.find((d) => d.isToday)?.items ?? []);
  return weekSubline(visibleCount(days), isCurrentWeek ? Some(today) : None);
}

function NoMatches() {
  return (
    <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
      No sessions match this week.
    </p>
  );
}

function WeekPanelError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-6 flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">Couldn&apos;t load this week&apos;s sessions.</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
