"use client";

import { useEffect, useId, useMemo, useState } from "react";
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
import { useUserTimezone } from "@/lib/hooks/use-user-timezone";
import { useWeekAt } from "@/lib/hooks/use-week-at";
import { useRefreshCoachingSessions } from "@/lib/hooks/use-sse-cache-invalidation";
import { useWeekEdges } from "@/lib/hooks/use-week-edges";
import { useLastSession } from "@/lib/hooks/use-last-session";
import { useWeekFilter } from "@/lib/hooks/use-week-filter";
import { useWeekSlide, WeekSlide } from "@/lib/hooks/use-week-slide";
import { useAdjacentWeekSessions, useWeekSessions } from "@/lib/hooks/use-week-sessions";
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
import { moveChoices, type MoveChoicesContext } from "@/lib/week-grid/move-choices";
import { slotsForMove } from "@/lib/week-grid/slots";
import { sessionStartIn } from "@/lib/session-window";
import type { SessionJump } from "@/lib/stores/week-grid-store";
import {
  agendaDay,
  CURRENT_WEEK,
  groupByDay,
  lastSessionLinkText,
  nowLineOn,
  weekOffsetOf,
  weekRange,
  weekSubline,
  weekTitle,
  type DayGroup,
  type Week,
} from "@/lib/week-grid/week";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { type Option, None, Some } from "@/types/option";
import { DayAgenda } from "./day-agenda";
import { DayStrip } from "./day-strip";
import { CalloutPlacement, EmptyWeekCallout, type EmptyWeekCalloutModel } from "./empty-week-callout";
import { MoveSheet, type MoveSheetModel } from "./move-sheet";
import type { SessionCardHandlers } from "./session-card";
import { WeekGrid, type GridDrag } from "./week-grid";
import { WeekPanelHeader, type WeekNavigation } from "./week-panel-header";

export interface WeekPanelProps {
  onReschedule: (session: EnrichedCoachingSession, scope?: MoveScope, target?: Option<DateTime>) => void;
  onSeriesMutated: () => void;
  onSchedule: (date: Option<DateTime>) => void;
}

function useWeekNavigation(isCurrentWeek: boolean, week: Week): WeekNavigation {
  const { previousWeek, nextWeek, thisWeek } = useWeekGridStore((s) => s);
  const { hasEarlier } = useWeekEdges(week);
  return {
    canGoEarlier: hasEarlier,
    isCurrentWeek,
    onPrevious: previousWeek,
    onNext: nextWeek,
    onThisWeek: thisWeek,
  };
}

function moveSheetModel(view: CardView, days: DayGroup<GridCard>[], context: MoveChoicesContext): MoveSheetModel {
  return {
    name: firstNameOf(view.name),
    current: view.start,
    now: context.now,
    days: days.map((d) => ({ day: d.day, past: d.isPast })),
    ...moveChoices(view.session, context),
  };
}

export function WeekPanel({ onReschedule, onSeriesMutated, onSchedule }: WeekPanelProps) {
  const timezone = useUserTimezone();
  const now = useNow(30_000);
  const weekOffset = useWeekGridStore((s) => s.weekOffset);
  const week = useWeekAt(weekOffset, now, timezone);
  const isCurrentWeek = weekOffset === CURRENT_WEEK;
  const isScheduler = useAuthStore((s) => s.canScheduleSessions);
  const navigation = useWeekNavigation(isCurrentWeek, week);
  const { sessions, isLoading, isError, refresh } = useWeekSessions(week);
  const adjacent = useAdjacentWeekSessions(week);
  // SWR keeps the last sessions when a read fails, so they stay visible but can't be changed.
  const readOnly = isError;
  const canSchedule = isScheduler && !readOnly;
  const viewerId = useAuthStore((s) => s.userId);
  const filter = useWeekFilter();
  const { selected } = filter;
  const width = useMediaQuery(WEEK_GRID_QUERY);

  const recentlyMoved = useWeekGridStore((s) => s.recentlyMoved);
  const highlighted = useWeekGridStore((s) => s.highlighted);
  const jumpToSession = useWeekGridStore((s) => s.jumpToSession);
  const clearHighlight = useWeekGridStore((s) => s.clearHighlight);
  // Leaving mid-flash mustn't flash and refocus the card on return.
  useEffect(() => clearHighlight, [clearHighlight]);
  const clearMoved = useWeekGridStore((s) => s.clearMoved);
  useEffect(() => clearMoved, [clearMoved]);

  const days = useMemo(() => {
    const cards = sessions.map((s): GridCard => {
      const base = cardView(s, { viewerId, now, timezone });
      const view = readOnly ? readOnlyView(base) : base;
      return {
        ...(recentlyMoved.includes(s.id) ? markMoved(view) : view),
        dimmed: isFilteredOut(s, selected),
        highlighted: highlighted.some && highlighted.val === s.id,
      };
    });
    return groupByDay(cards, (c) => c.start, week, now);
  }, [sessions, viewerId, now, timezone, week, selected, recentlyMoved, readOnly, highlighted]);

  const [moveTarget, setMoveTarget] = useState<Option<CardView>>(None);

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
      onHighlightEnd: clearHighlight,
      ...(canSchedule && { onMove: (view: CardView) => setMoveTarget(Some(view)) }),
    }),
    [run, canSchedule, clearHighlight]
  );

  const hours = useWorkingHours();
  const slotsContext = { sessions, viewerId, timezone, hours, now };
  const moveModel = useMemo(
    () =>
      moveTarget.some
        ? Some(
            moveSheetModel(moveTarget.val, days, {
              sessions: [...sessions, ...adjacent.sessions],
              viewerId,
              timezone,
              hours,
              now,
              known: adjacent.known,
            })
          )
        : None,
    [moveTarget, days, sessions, adjacent, viewerId, timezone, hours, now]
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
    filter: isScheduler
      ? Some({
          people: filter.people,
          grouped: filter.grouped,
          selected,
          onSelect: filter.select,
          onClear: filter.clear,
          onOpen: filter.load,
        })
      : None,
    onSchedule: isScheduler ? Some(() => onSchedule(None)) : None,
    readOnly,
  };
  const scheduleDay = canSchedule ? Some((day: DateTime) => onSchedule(Some(day))) : None;
  const hasSessions = sessions.length > 0;
  // A failed read with nothing cached must not call the week or its days empty.
  const isUnloaded = readOnly && !hasSessions;
  // Nothing loaded is not the same as nothing matching.
  const isEmpty = !isLoading && !isUnloaded && visibleCount(days) === 0;
  // Asked only for an empty week, the one place the link shows.
  const lastSession = useLastSession(selected, now, isEmpty);
  const callout = isEmpty ? emptyWeekCallout(selected.some, lastSession, { now, timezone, jump: jumpToSession }) : None;
  const busy = isLoading || width.none;
  const slide = useWeekSlide(weekOffset);
  const subline = busy || isUnloaded ? None : Some(sublineFor(days, isCurrentWeek));

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={busy}
      className="overflow-x-clip rounded-card border bg-card p-7"
    >
      <WeekPanelHeader {...header} subline={subline} />
      {!busy && readOnly && <ReadOnlyNotice hasSessions={hasSessions} onRetry={() => refresh()} />}
      {/* Keyed so each new week mounts and runs its slide once. */}
      <div key={weekOffset} data-testid="week-days" className={cn(slide.some && SLIDE_CLASS[slide.val])}>
        <WeekBody
          width={width}
          isLoading={isLoading}
          days={days}
          week={week}
          now={now}
          handlers={handlers}
          onSchedule={scheduleDay}
          callout={callout}
          isUnloaded={isUnloaded}
          drag={drag}
        />
      </div>
      <SessionActionDialogs {...actions.dialogs} />
      {/* A failed read leaves availability untrusted, so an open sheet closes. */}
      <MoveSheet model={readOnly ? None : moveModel} onConfirm={confirmMove} onResolve={resolveMove} onClose={closeMove} />
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
  const { days, now, handlers, onSchedule, callout, isUnloaded } = agenda;
  if (width.none) return <PendingLayouts {...agenda} drag={drag} />;
  const wide = width.val;
  if (isLoading) return wide ? <WeekGrid days={days} handlers={handlers} onSchedule={onSchedule} drag={drag} now={now} isLoading isUnloaded={isUnloaded} /> : <WeekAgenda {...agenda} callout={None} isLoading />;
  if (!wide) return <WeekAgenda {...agenda} isLoading={false} />;
  return (
    <div className="relative">
      <WeekGrid days={days} handlers={handlers} onSchedule={onSchedule} drag={drag} now={now} isLoading={false} isUnloaded={isUnloaded} />
      {callout.some && (
        // Centred on the grid's minimum height (week-grid.tsx), below the first row's Schedule
        // buttons, so it holds still as weeks change. Only the link takes clicks.
        <div className="pointer-events-none absolute inset-x-0 top-[214px] flex -translate-y-1/2 justify-center">
          <EmptyWeekCallout model={callout.val} placement={CalloutPlacement.Floating} />
        </div>
      )}
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
  callout: Option<EmptyWeekCalloutModel>;
  isUnloaded: boolean;
}

/** While a week loads, its dates still show; only the day's sessions wait. */
function WeekAgenda({ days, week, now, handlers, callout, isUnloaded, isLoading }: WeekAgendaProps & { isLoading: boolean }) {
  const selectedDay = useWeekGridStore((s) => s.selectedDay);
  const selectDay = useWeekGridStore((s) => s.selectDay);
  const day = agendaDay(week, selectedDay, now);
  const group = days.find((g) => g.day.hasSame(day, "day")) ?? days[0];
  return (
    <>
      <DayStrip days={days} selected={day} onSelect={(d) => selectDay(d.toFormat(ISO_DATE))} />
      {callout.some && <EmptyWeekCallout model={callout.val} placement={CalloutPlacement.Inline} />}
      <DayAgenda
        group={group}
        handlers={handlers}
        now={nowLineOn(group, now)}
        isUnloaded={isUnloaded}
        isLoading={isLoading}
      />
    </>
  );
}

const ISO_DATE = "yyyy-MM-dd";

const SLIDE_CLASS: Record<WeekSlide, string> = {
  [WeekSlide.FromLeft]: "animate-week-enter-from-left motion-reduce:animate-none",
  [WeekSlide.FromRight]: "animate-week-enter-from-right motion-reduce:animate-none",
};

const visible = (cards: GridCard[]) => cards.filter((c) => !c.dimmed).length;

function visibleCount(days: DayGroup<GridCard>[]): number {
  return days.reduce((sum, d) => sum + visible(d.items), 0);
}

function sublineFor(days: DayGroup<GridCard>[], isCurrentWeek: boolean): string {
  const today = visible(days.find((d) => d.isToday)?.items ?? []);
  return weekSubline(visibleCount(days), isCurrentWeek ? Some(today) : None);
}

interface JumpContext {
  now: DateTime;
  timezone: string;
  jump: (target: SessionJump) => void;
}

/** A filtered week always says nothing matches; an unfiltered one speaks up only with somewhere to go. */
function emptyWeekCallout(
  filtered: boolean,
  last: Option<EnrichedCoachingSession>,
  { now, timezone, jump }: JumpContext
): Option<EmptyWeekCalloutModel> {
  if (!filtered && last.none) return None;
  const message = filtered ? "No sessions match this week." : "No sessions this week.";
  if (last.none) return Some({ message, jump: None });
  const start = sessionStartIn(last.val.date, timezone);
  const target = { weekOffset: weekOffsetOf(start, now, timezone), day: start.toFormat(ISO_DATE), sessionId: last.val.id };
  return Some({ message, jump: Some({ label: lastSessionLinkText(start, now), onJump: () => jump(target) }) });
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
