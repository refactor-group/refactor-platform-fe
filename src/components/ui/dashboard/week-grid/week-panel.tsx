"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { DateTime } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionActionDialogs } from "@/components/ui/dashboard/session-action-dialogs";
import { useSessionActions } from "@/components/ui/dashboard/use-session-actions";
import { WEEK_GRID_QUERY } from "@/lib/breakpoints";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useWeekGridStore } from "@/lib/providers/week-grid-store-provider";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useMoveSession } from "@/lib/hooks/use-move-session";
import { useNow } from "@/lib/hooks/use-now";
import { useScheduleTimezone } from "@/lib/hooks/use-schedule-data";
import { useRefreshCoachingSessions } from "@/lib/hooks/use-sse-cache-invalidation";
import { useWeekEdges } from "@/lib/hooks/use-week-edges";
import { useWeekFilter } from "@/lib/hooks/use-week-filter";
import { useWeekSessions } from "@/lib/hooks/use-week-sessions";
import { useWorkingHours } from "@/lib/hooks/use-working-hours";
import { busySessions } from "@/lib/schedule-draft";
import { SessionAction } from "@/lib/session-actions";
import type { MoveScope, WorkingHours } from "@/lib/scheduling";
import { firstNameOf } from "@/lib/scheduling-copy";
import { cardView, markMoved, type CardView, type GridCard } from "@/lib/week-grid/card";
import { isFilteredOut } from "@/lib/week-grid/filter";
import { daySlots } from "@/lib/week-grid/slots";
import {
  agendaDay,
  groupByDay,
  weekOf,
  weekRange,
  weekSubline,
  weekTitle,
  type DayGroup,
  type Week,
} from "@/lib/week-grid/week";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import { DayAgenda } from "./day-agenda";
import { DayStrip } from "./day-strip";
import { MoveSheet, type MoveSheetModel } from "./move-sheet";
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

interface MoveContext {
  days: DayGroup<GridCard>[];
  sessions: EnrichedCoachingSession[];
  viewerId: Id;
  timezone: string;
  hours: WorkingHours;
  now: DateTime;
}

function moveSheetModel(view: CardView, context: MoveContext): MoveSheetModel {
  const { days, sessions, viewerId, timezone, hours, now } = context;
  const busy = busySessions(sessions, viewerId, timezone);
  const [moving] = busySessions([view.session], viewerId, timezone);
  return {
    name: firstNameOf(view.name),
    current: view.start,
    days: days.map((d) => ({ day: d.day, past: d.isPast })),
    slotsFor: (day) => daySlots({ day, moving, busy, hours, now }),
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
  const wide = useMediaQuery(WEEK_GRID_QUERY);

  const onSessionsChanged = useRefreshCoachingSessions();
  const actions = useSessionActions({
    userTimezone: timezone,
    onReschedule,
    onSessionsChanged,
    onSeriesMutated,
  });

  const recentlyMoved = useWeekGridStore((s) => s.recentlyMoved);
  const clearMoved = useWeekGridStore((s) => s.clearMoved);
  useEffect(() => clearMoved, [clearMoved]);

  const days = useMemo(() => {
    const cards = sessions.map((s): GridCard => {
      const view = cardView(s, { viewerId, now, timezone });
      return { ...(recentlyMoved.includes(s.id) ? markMoved(view) : view), dimmed: isFilteredOut(s, selected) };
    });
    return groupByDay(cards, (c) => c.start, week, now);
  }, [sessions, viewerId, now, timezone, week, selected, recentlyMoved]);

  const [moveTarget, setMoveTarget] = useState<Option<CardView>>(None);
  const openMove = useCallback(
    (session: EnrichedCoachingSession) => {
      const view = days.flatMap((d) => d.items).find((c) => c.session.id === session.id);
      if (view) setMoveTarget(Some(view));
    },
    [days]
  );

  const { run } = actions;
  const handlers = useMemo<SessionCardHandlers>(
    () => ({
      onAction: (action, session) => (action === SessionAction.Move ? openMove(session) : run(action, session)),
      onOpen: (view) => run(SessionAction.OpenSession, view.session),
      ...(canSchedule && { onMove: (view: CardView) => setMoveTarget(Some(view)) }),
    }),
    [run, openMove, canSchedule]
  );

  const hours = useWorkingHours();
  const moveModel = moveTarget.some
    ? Some(moveSheetModel(moveTarget.val, { days, sessions, viewerId, timezone, hours, now }))
    : None;
  const moveSession = useMoveSession();
  const selectDay = useWeekGridStore((s) => s.selectDay);
  const closeMove = () => setMoveTarget(None);
  const confirmMove = (to: DateTime) => {
    if (moveTarget.none) return;
    const { session, name } = moveTarget.val;
    moveSession({ session, name, to });
    selectDay(to.toFormat(ISO_DATE));
    closeMove();
  };

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
  const noMatches = selected.some && visibleCount(days) === 0;
  const subline = isLoading || isError ? None : Some(sublineFor(days, isCurrentWeek));

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={isLoading}
      className="rounded-card border bg-card p-7"
    >
      <WeekPanelHeader {...header} subline={subline} />
      {!wide && !isCurrentWeek && <BackToThisWeek onClick={navigation.onThisWeek} />}
      {isLoading ? (
        wide ? (
          <WeekGrid days={days} handlers={handlers} onSchedule={scheduleDay} isLoading />
        ) : (
          <DayAgendaSkeleton />
        )
      ) : isError ? (
        <WeekPanelError onRetry={refresh} />
      ) : wide ? (
        <div className="relative">
          <WeekGrid days={days} handlers={handlers} onSchedule={scheduleDay} isLoading={false} />
          {noMatches && <NoMatches className="pointer-events-none absolute inset-0 flex items-center justify-center" />}
        </div>
      ) : (
        <WeekAgenda days={days} week={week} now={now} handlers={handlers} onSchedule={scheduleDay} noMatches={noMatches} />
      )}
      <SessionActionDialogs {...actions.dialogs} />
      <MoveSheet model={moveModel} onConfirm={confirmMove} onClose={closeMove} />
    </section>
  );
}

interface WeekAgendaProps {
  days: DayGroup<GridCard>[];
  week: Week;
  now: DateTime;
  handlers: SessionCardHandlers;
  onSchedule: Option<(day: DateTime) => void>;
  noMatches: boolean;
}

function WeekAgenda({ days, week, now, handlers, onSchedule, noMatches }: WeekAgendaProps) {
  const selectedDay = useWeekGridStore((s) => s.selectedDay);
  const selectDay = useWeekGridStore((s) => s.selectDay);
  const day = agendaDay(week, selectedDay, now);
  const group = days.find((g) => g.day.hasSame(day, "day")) ?? days[0];
  return (
    <>
      <DayStrip days={days} selected={day} onSelect={(d) => selectDay(d.toFormat(ISO_DATE))} />
      {noMatches && <NoMatches className="mt-4" />}
      <DayAgenda group={group} handlers={handlers} onSchedule={onSchedule} />
    </>
  );
}

const ISO_DATE = "yyyy-MM-dd";

function BackToThisWeek({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="link" className="mt-3 h-auto px-0 text-[13px]" onClick={onClick}>
      Back to this week
    </Button>
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

function NoMatches({ className }: { className: string }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      No sessions match this week.
    </p>
  );
}

function DayAgendaSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-2.5">
      <Skeleton className="mb-3.5 h-11 rounded-full" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
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
