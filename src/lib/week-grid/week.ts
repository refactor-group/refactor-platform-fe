import { DateTime } from "ts-luxon";
import { sessionCount } from "@/lib/scheduling-copy";
import { sessionStartIn } from "@/lib/session-window";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { type Option, None, Some } from "@/types/option";

export interface Week {
  start: DateTime;
  days: DateTime[];
}

/** Only the past has an edge: anyone can page ahead into weeks with nothing scheduled. */
export interface WeekEdges {
  hasEarlier: boolean;
}

export interface DayGroup<T> {
  day: DateTime;
  isToday: boolean;
  isPast: boolean;
  items: T[];
}

const DAYS_IN_WEEK = 7;

export function weekOf(offset: number, now: DateTime, timezone: string): Week {
  const start = now.setZone(timezone).startOf("week").plus({ weeks: offset });
  // Calendar-day steps keep local midnights across DST changes.
  const days = Array.from({ length: DAYS_IN_WEEK }, (_, i) => start.plus({ days: i }));
  return { start, days };
}

export function agendaDay(week: Week, selected: Option<string>, now: DateTime): DateTime {
  const today = now.setZone(week.start.zone);
  return (
    week.days.find((d) => selected.some && d.toISODate() === selected.val) ??
    week.days.find((d) => d.hasSame(today, "day")) ??
    week.days[0]
  );
}

export function weekTitle(offset: number, week: Week): string {
  switch (offset) {
    case 0:
      return "This week";
    case -1:
      return "Last week";
    case 1:
      return "Next week";
    default:
      return `Week of ${week.start.toFormat("LLL d")}`;
  }
}

/** "Aug 17 – 23, 2026", "Aug 31 – Sep 6, 2026", or "Dec 28, 2026 – Jan 3, 2027". */
export function weekRange(week: Week): string {
  const first = week.days[0];
  const last = week.days[DAYS_IN_WEEK - 1];
  const firstFormat = first.hasSame(last, "year") ? "LLL d" : "LLL d, yyyy";
  const lastFormat = first.hasSame(last, "month") ? "d, yyyy" : "LLL d, yyyy";
  return `${first.toFormat(firstFormat)} – ${last.toFormat(lastFormat)}`;
}

export function weekSubline(visible: number, today: Option<number>): string {
  const count = sessionCount(visible);
  return today.some && today.val > 0 ? `${count} · ${today.val} today` : count;
}

export function weekEdges(aroundStart: EnrichedCoachingSession[], week: Week): WeekEdges {
  const zone = week.start.zoneName;
  return { hasEarlier: aroundStart.some((s) => sessionStartIn(s.date, zone) < week.start) };
}

export function groupByDay<T>(
  items: T[],
  startOf: (item: T) => DateTime,
  week: Week,
  now: DateTime
): DayGroup<T>[] {
  const zone = week.start.zone;
  const today = now.setZone(zone).startOf("day");
  const sorted = [...items].sort((a, b) => startOf(a).toMillis() - startOf(b).toMillis());
  return week.days.map((day) => ({
    day,
    isToday: day.hasSame(today, "day"),
    isPast: day < today,
    items: sorted.filter((item) => startOf(item).setZone(zone).hasSame(day, "day")),
  }));
}

/** Where the now line goes: above the first item that hasn't started. */
export function nowLineIndex<T>(items: T[], startOf: (item: T) => DateTime, now: DateTime): number {
  const next = items.findIndex((item) => startOf(item) > now);
  return next === -1 ? items.length : next;
}

/** The now line's time for a day, shown only on today. */
export function nowLineOn<T>(group: DayGroup<T>, now: DateTime): Option<DateTime> {
  return group.isToday ? Some(now.setZone(group.day.zone)) : None;
}

export function scheduleOn<T>(
  group: DayGroup<T>,
  onSchedule: Option<(day: DateTime) => void>
): Option<() => void> {
  return onSchedule.some && !group.isPast ? Some(() => onSchedule.val(group.day)) : None;
}
