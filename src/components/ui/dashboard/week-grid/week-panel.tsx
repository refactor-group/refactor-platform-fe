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
import { SessionAction } from "@/lib/session-actions";
import { MoveScope } from "@/lib/scheduling";
import { firstNameOf } from "@/lib/scheduling-copy";
import {
  cardView,
  markMoved,
  readOnlyView,
  type CardView,
  type GridCard,
} from "@/lib/week-grid/card";
import { isFilteredOut } from "@/lib/week-grid/filter";
import { moveChoices } from "@/lib/week-grid/move-choices";
import { slotsForMove, type MoveSlotsContext } from "@/lib/week-grid/slots";
import {
  agendaDay,
  groupByDay,
  nowLineOn,
  weekOf,
  weekRange,
  weekSubline,
  weekTitle,
  type DayGroup,
  type Week,
} from "@/lib/week-grid/week";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { type Option, None, Some, unwrapOr } from "@/types/option";
import { DayAgenda } from "./day-agenda";
import { DayStrip } from "./day-strip";
import { MoveSheet, type MoveSheetModel } from "./move-sheet";
import type { SessionCardHandlers } from "./session-card";
import { WeekGrid, type GridDrag } from "./week-grid";
import { WeekPanelHeader, type WeekNavigation } from "./week-panel-header";

export interface WeekPanelProps {
  onReschedule: (session: EnrichedCoachingSession, scope?: MoveScope, target?: Option<DateTime>) => void;
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

function useWeekNavigation(isCurrentWeek: boolean, isCoach: boolean, week: Week): WeekNavigation {
  const { previousWeek, nextWeek, thisWeek } = useWeekGridStore((s) => s);
  const { hasEarlier, hasLater } = useWeekEdges(week);
  return {
    canGoEarlier: hasEarlier,
    // A coach can always page ahead to schedule into an empty week.
    canGoLater: isCoach || hasLater,
    isCurrentWeek,
    onPrevious: previousWeek,
    onNext: nextWeek,
    onThisWeek: thisWeek,
  };
}

function moveSheetModel(view: CardView, days: DayGroup<GridCard>[], context: MoveSlotsContext): MoveSheetModel {
  return {
    name: firstNameOf(view.name),
    current: view.start,
    now: context.now,
    days: days.map((d) => ({ day: d.day, past: d.isPast })),
    ...moveChoices(view.session, context),
  };
}

export function WeekPanel({ onReschedule, onSeriesMutated, onSchedule }: WeekPanelProps) {
  const timezone = useScheduleTimezone();
  const now = useNow(30_000);
  const weekOffset = useWeekGridStore((s) => s.weekOffset);
  const week = useWeekAt(weekOffset, now, timezone);
  const isCurrentWeek = weekOffset === CURRENT_WEEK;
  const isCoach = useAuthStore((s) => s.isACoach);
  const navigation = useWeekNavigation(isCurrentWeek, isCoach, week);
  const { sessions, isLoading, isError, refresh } = useWeekSessions(week);
  // SWR keeps the last sessions when a read fails, so they stay visible but can't be changed.
  const readOnly = isError;
  const canSchedule = isCoach && !readOnly;
  const viewerId = useAuthStore((s) => s.userId);
  const filter = useWeekFilter();
  const { selected } = filter;
  const width = useMediaQuery(WEEK_GRID_QUERY);

  const recentlyMoved = useWeekGridStore((s) => s.recentlyMoved);
  const clearMoved = useWeekGridStore((s) => s.clearMoved);
  useEffect(() => clearMoved, [clearMoved]);

  const days = useMemo(() => {
    const cards = sessions.map((s): GridCard => {
      const base = cardView(s, { viewerId, now, timezone });
      const view = readOnly ? readOnlyView(base) : base;
      return { ...(recentlyMoved.includes(s.id) ? markMoved(view) : view), dimmed: isFilteredOut(s, selected) };
    });
    return groupByDay(cards, (c) => c.start, week, now);
  }, [sessions, viewerId, now, timezone, week, selected, recentlyMoved, readOnly]);

  const [moveTarget, setMoveTarget] = useState<Option<CardView>>(None);
  const openMove = useCallback(
    (session: EnrichedCoachingSession) => {
      const view = days.flatMap((d) => d.items).find((c) => c.session.id === session.id);
      if (view) setMoveTarget(Some(view));
    },
    [days]
  );

  const onSessionsChanged = useRefreshCoachingSessions();
  const actions = useSessionActions({
    userTimezone: timezone,
    onReschedule,
    onMove: openMove,
    onSessionsChanged,
    onSeriesMutated,
  });

  const { run } = actions;
  const handlers = useMemo<SessionCardHandlers>(
    () => ({
      onAction: run,
      onOpen: (view) => run(SessionAction.OpenSession, view.session),
      ...(canSchedule && { onMove: (view: CardView) => setMoveTarget(Some(view)) }),
    }),
    [run, canSchedule]
  );

  const hours = useWorkingHours();
  const slotsContext = { sessions, viewerId, timezone, hours, now };
  const moveModel = useMemo(
    () =>
      moveTarget.some
        ? Some(moveSheetModel(moveTarget.val, days, { sessions, viewerId, timezone, hours, now }))
        : None,
    [moveTarget, days, sessions, viewerId, timezone, hours, now]
  );
  const moveSession = useMoveSession();
  const drag: GridDrag = {
    slotsFor: (session) => slotsForMove(session, slotsContext),
    onMove: ({ session, name }, to) => moveSession({ session, name, to }),
    onResolve: ({ session }, to) => onReschedule(session, MoveScope.This, Some(to)),
  };
  const selectDay = useWeekGridStore((s) => s.selectDay);
  const closeMove = () => setMoveTarget(None);
  const confirmMove = (to: DateTime) => {
    if (moveTarget.none) return;
    const { session, name } = moveTarget.val;
    moveSession({ session, name, to });
    selectDay(to.toFormat(ISO_DATE));
    closeMove();
  };
  const resolveMove = (to: DateTime) => {
    if (moveTarget.none) return;
    closeMove();
    onReschedule(moveTarget.val.session, MoveScope.This, Some(to));
  };

  const titleId = useId();
  const header = {
    titleId,
    title: weekTitle(weekOffset, week),
    range: weekRange(week),
    navigation,
    filter: isCoach
      ? Some({
          people: filter.people,
          grouped: filter.grouped,
          selected,
          onSelect: filter.select,
          onClear: filter.clear,
          onOpen: filter.load,
        })
      : None,
    onSchedule: isCoach ? Some(() => onSchedule(None)) : None,
    readOnly,
  };
  const scheduleDay = canSchedule ? Some((day: DateTime) => onSchedule(Some(day))) : None;
  const noMatches = selected.some && visibleCount(days) === 0;
  const hasSessions = sessions.length > 0;
  // A failed read with nothing cached must not call the week or its days empty.
  const isUnloaded = readOnly && !hasSessions;
  const busy = isLoading || width.none;
  const subline = busy || isUnloaded ? None : Some(sublineFor(days, isCurrentWeek));

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={busy}
      className="rounded-card border bg-card p-7"
    >
      <WeekPanelHeader {...header} subline={subline} />
      {!isCurrentWeek && !unwrapOr(width, false) && (
        <BackToThisWeek pending={width.none} onClick={navigation.onThisWeek} />
      )}
      {!busy && readOnly && <ReadOnlyNotice hasSessions={hasSessions} onRetry={refresh} />}
      <WeekBody
        width={width}
        isLoading={isLoading}
        days={days}
        week={week}
        now={now}
        handlers={handlers}
        onSchedule={scheduleDay}
        noMatches={noMatches}
        isUnloaded={isUnloaded}
        drag={drag}
      />
      <SessionActionDialogs {...actions.dialogs} />
      <MoveSheet model={moveModel} onConfirm={confirmMove} onResolve={resolveMove} onClose={closeMove} />
    </section>
  );
}

interface WeekBodyProps extends WeekAgendaProps {
  width: Option<boolean>;
  isLoading: boolean;
  drag: GridDrag;
}

/** Until the width is known, both loading layouts render and CSS shows one. */
function WeekBody({ width, isLoading, drag, ...agenda }: WeekBodyProps) {
  const { days, now, handlers, onSchedule, noMatches, isUnloaded } = agenda;
  if (width.none) return <PendingLayouts {...agenda} drag={drag} />;
  const wide = width.val;
  if (isLoading) return wide ? <WeekGrid days={days} handlers={handlers} onSchedule={onSchedule} drag={drag} now={now} isLoading isUnloaded={isUnloaded} /> : <DayAgendaSkeleton />;
  if (!wide) return <WeekAgenda {...agenda} />;
  return (
    <div className="relative">
      <WeekGrid days={days} handlers={handlers} onSchedule={onSchedule} drag={drag} now={now} isLoading={false} isUnloaded={isUnloaded} />
      {noMatches && <NoMatches className="pointer-events-none absolute inset-0 flex items-center justify-center" />}
    </div>
  );
}

function PendingLayouts({ days, now, handlers, onSchedule, isUnloaded, drag }: WeekAgendaProps & { drag: GridDrag }) {
  return (
    <>
      <div data-testid="week-grid-pending" className="hidden lg:block">
        <WeekGrid days={days} handlers={handlers} onSchedule={onSchedule} drag={drag} now={now} isLoading isUnloaded={isUnloaded} />
      </div>
      <div data-testid="day-agenda-pending" className="lg:hidden">
        <DayAgendaSkeleton />
      </div>
    </>
  );
}

interface WeekAgendaProps {
  days: DayGroup<GridCard>[];
  week: Week;
  now: DateTime;
  handlers: SessionCardHandlers;
  onSchedule: Option<(day: DateTime) => void>;
  noMatches: boolean;
  isUnloaded: boolean;
}

function WeekAgenda({ days, week, now, handlers, onSchedule, noMatches, isUnloaded }: WeekAgendaProps) {
  const selectedDay = useWeekGridStore((s) => s.selectedDay);
  const selectDay = useWeekGridStore((s) => s.selectDay);
  const day = agendaDay(week, selectedDay, now);
  const group = days.find((g) => g.day.hasSame(day, "day")) ?? days[0];
  return (
    <>
      <DayStrip days={days} selected={day} onSelect={(d) => selectDay(d.toFormat(ISO_DATE))} />
      {noMatches && <NoMatches className="mt-4" />}
      <DayAgenda
        group={group}
        handlers={handlers}
        onSchedule={onSchedule}
        now={nowLineOn(group, now)}
        isUnloaded={isUnloaded}
      />
    </>
  );
}

const ISO_DATE = "yyyy-MM-dd";

function BackToThisWeek({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <Button variant="link" className={cn("mt-3 h-auto px-0 text-[13px]", pending && "lg:hidden")} onClick={onClick}>
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

function readOnlyNoticeText(hasSessions: boolean): string {
  return hasSessions
    ? "Can't reach the server right now. These sessions may be out of date."
    : "Couldn't load this week's sessions.";
}

function ReadOnlyNotice({ hasSessions, onRetry }: { hasSessions: boolean; onRetry: () => void }) {
  return (
    <div role="status" className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-sm text-muted-foreground">{readOnlyNoticeText(hasSessions)}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
