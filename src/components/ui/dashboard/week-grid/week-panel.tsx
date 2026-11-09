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
import { useWeekSessions } from "@/lib/hooks/use-week-sessions";
import { SessionAction } from "@/lib/session-actions";
import type { MoveScope } from "@/lib/scheduling";
import { toast } from "@/lib/toast";
import { CardClick, cardClick, cardView, type CardView } from "@/lib/week-grid/card";
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
import type { OnSessionAction } from "./session-card-menu";
import { WeekGrid } from "./week-grid";
import { WeekPanelHeader, type WeekNavigation } from "./week-panel-header";

export interface WeekPanelProps {
  onReschedule: (session: EnrichedCoachingSession, scope?: MoveScope) => void;
  onSeriesMutated: () => void;
  onSchedule: (date: Option<DateTime>) => void;
}

const CURRENT_WEEK = 0;
const PAST_HINT = "Past session · double-click to open its notes";

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
      onSelect: (view) => onCardSelect(view, run),
      onOpen: (view) => run(SessionAction.OpenSession, view.session),
    }),
    [run]
  );

  const days = useMemo(() => {
    const views = sessions.map((s) => cardView(s, { viewerId, now, timezone }));
    return groupByDay(views, (v) => v.start, week, now);
  }, [sessions, viewerId, now, timezone, week]);

  const titleId = useId();
  const header = {
    titleId,
    title: weekTitle(weekOffset, week),
    range: weekRange(week),
    navigation,
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
          <WeekGrid days={days} handlers={handlers} onSchedule={scheduleDay} isLoading={false} />
        </>
      )}
      <SessionActionDialogs {...actions.dialogs} />
    </section>
  );
}

function onCardSelect(view: CardView, run: OnSessionAction) {
  const click = cardClick(view);
  switch (click) {
    case CardClick.Open:
      run(SessionAction.OpenSession, view.session);
      return;
    case CardClick.Reschedule:
      run(SessionAction.Reschedule, view.session);
      return;
    case CardClick.PastHint:
      toast(PAST_HINT);
      return;
    case CardClick.Nothing:
      return;
    default: {
      const _exhaustive: never = click;
      throw new Error(`Unhandled card click: ${_exhaustive}`);
    }
  }
}

function sublineFor(days: DayGroup<CardView>[], isCurrentWeek: boolean): string {
  const count = days.reduce((sum, d) => sum + d.items.length, 0);
  const today = days.find((d) => d.isToday)?.items.length ?? 0;
  return weekSubline(count, isCurrentWeek ? Some(today) : None);
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
