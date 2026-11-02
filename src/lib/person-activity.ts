import type { DateTime } from "ts-luxon";
import type { WhenLine } from "@/components/ui/join-session/types";
import { type Option, None, Some } from "@/types/option";

/** People with no upcoming session stay active this many days after their last one. */
export const ACTIVE_DAYS = 30;

const WEEK_DAYS = 7;

/** A session's start in the user's timezone, and whether it has ended. */
export interface ActivitySession {
  start: DateTime;
  over: boolean;
}

export type PersonActivity =
  | { kind: "upcoming"; next: DateTime }
  | { kind: "recent"; last: DateTime }
  | { kind: "inactive"; last: Option<DateTime> };

function earliest(dates: DateTime[]): Option<DateTime> {
  return dates.length > 0 ? Some(dates.reduce((a, b) => (b < a ? b : a))) : None;
}

function latest(dates: DateTime[]): Option<DateTime> {
  return dates.length > 0 ? Some(dates.reduce((a, b) => (b > a ? b : a))) : None;
}

export function personActivity(sessions: ActivitySession[], now: DateTime): PersonActivity {
  const next = earliest(sessions.filter((s) => !s.over).map((s) => s.start));
  if (next.some) return { kind: "upcoming", next: next.val };
  const last = latest(sessions.filter((s) => s.over).map((s) => s.start));
  if (last.some && now.diff(last.val, "days").days <= ACTIVE_DAYS) {
    return { kind: "recent", last: last.val };
  }
  return { kind: "inactive", last };
}

export function isInactive(activity: PersonActivity): boolean {
  return activity.kind === "inactive";
}

function daysAhead(date: DateTime, now: DateTime): number {
  return date.startOf("day").diff(now.startOf("day"), "days").days;
}

function lastLine(last: DateTime, tone: WhenLine["tone"]): WhenLine {
  return { text: `Last ${last.toFormat("LLL d")}`, tone };
}

export function whenLine(activity: PersonActivity, now: DateTime): WhenLine {
  switch (activity.kind) {
    case "upcoming": {
      const days = daysAhead(activity.next, now);
      if (days <= 0) return { text: activity.next.toFormat("h:mma").toLowerCase(), tone: "accent" };
      if (days < WEEK_DAYS) return { text: activity.next.toFormat("ccc"), tone: "muted" };
      return { text: activity.next.toFormat("LLL d"), tone: "muted" };
    }
    case "recent":
      return lastLine(activity.last, "muted");
    case "inactive":
      return activity.last.some ? lastLine(activity.last.val, "faint") : { text: "No sessions", tone: "faint" };
    default: {
      const _exhaustive: never = activity;
      throw new Error(`Unhandled person activity: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function sortKey(activity: PersonActivity): [number, number] {
  switch (activity.kind) {
    case "upcoming":
      return [0, activity.next.toMillis()];
    case "recent":
      return [1, -activity.last.toMillis()];
    case "inactive":
      return [2, activity.last.some ? -activity.last.val.toMillis() : Infinity];
    default: {
      const _exhaustive: never = activity;
      throw new Error(`Unhandled person activity: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Soonest upcoming session first, then people seen in the last 30 days (most
 * recent first), then inactive people (most recent first, never-met last).
 * Ties keep their input order.
 */
export function byActivity<T>(items: T[], activityOf: (item: T) => PersonActivity): T[] {
  return [...items].sort((a, b) => {
    const [groupA, timeA] = sortKey(activityOf(a));
    const [groupB, timeB] = sortKey(activityOf(b));
    return groupA !== groupB ? groupA - groupB : timeA - timeB;
  });
}
