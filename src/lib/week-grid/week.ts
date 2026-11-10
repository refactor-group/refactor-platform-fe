import { DateTime } from "ts-luxon";
import { sessionCount } from "@/lib/scheduling-copy";
import { sessionStartIn } from "@/lib/session-window";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Option } from "@/types/option";

export interface Week {
  start: DateTime;
  days: DateTime[];
}

export interface WeekEdges {
  hasEarlier: boolean;
  hasLater: boolean;
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

export function weekRange(week: Week): string {
  const first = week.days[0];
  const last = week.days[DAYS_IN_WEEK - 1];
  const lastFormat = first.hasSame(last, "month") ? "d" : "LLL d";
  return `${first.toFormat("LLL d")} – ${last.toFormat(lastFormat)}`;
}

export function weekSubline(visible: number, today: Option<number>): string {
  const count = sessionCount(visible);
  return today.some && today.val > 0 ? `${count} · ${today.val} today` : count;
}

export function weekEdges(
  aroundStart: EnrichedCoachingSession[],
  aroundEnd: EnrichedCoachingSession[],
  week: Week
): WeekEdges {
  const zone = week.start.zoneName;
  const nextStart = week.start.plus({ weeks: 1 });
  const startOf = (s: EnrichedCoachingSession) => sessionStartIn(s.date, zone);
  return {
    hasEarlier: aroundStart.some((s) => startOf(s) < week.start),
    hasLater: aroundEnd.some((s) => startOf(s) >= nextStart),
  };
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
