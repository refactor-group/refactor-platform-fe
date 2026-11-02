import type { DateTime } from "ts-luxon";
import type { WhenLine } from "@/components/ui/join-session/types";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";

/** People with no upcoming session stay active this many days after their last one. */
export const ACTIVE_DAYS = 30;

const WEEK_DAYS = 7;

/** A session's start in the user's timezone, whether it has ended, and its relationship. */
export interface ActivitySession {
  start: DateTime;
  over: boolean;
  relationshipId: Id;
}

export type PersonActivity =
  | { kind: "upcoming"; next: ActivitySession }
  | { kind: "recent"; last: ActivitySession }
  | { kind: "inactive"; last: Option<ActivitySession> };

function earliest(sessions: ActivitySession[]): Option<ActivitySession> {
  return sessions.length > 0 ? Some(sessions.reduce((a, b) => (b.start < a.start ? b : a))) : None;
}

function latest(sessions: ActivitySession[]): Option<ActivitySession> {
  return sessions.length > 0 ? Some(sessions.reduce((a, b) => (b.start > a.start ? b : a))) : None;
}

export function personActivity(sessions: ActivitySession[], now: DateTime): PersonActivity {
  const next = earliest(sessions.filter((s) => !s.over));
  if (next.some) return { kind: "upcoming", next: next.val };
  const last = latest(sessions.filter((s) => s.over));
  if (last.some && now.diff(last.val.start, "days").days <= ACTIVE_DAYS) {
    return { kind: "recent", last: last.val };
  }
  return { kind: "inactive", last };
}

/** The relationship of the session the person's when line shows. */
export function activityRelationship(activity: PersonActivity): Option<Id> {
  switch (activity.kind) {
    case "upcoming":
      return Some(activity.next.relationshipId);
    case "recent":
      return Some(activity.last.relationshipId);
    case "inactive":
      return activity.last.some ? Some(activity.last.val.relationshipId) : None;
    default: {
      const _exhaustive: never = activity;
      throw new Error(`Unhandled person activity: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function isInactive(activity: PersonActivity): boolean {
  return activity.kind === "inactive";
}

function daysAhead(date: DateTime, now: DateTime): number {
  return date.startOf("day").diff(now.startOf("day"), "days").days;
}

function lastLine(last: DateTime): WhenLine {
  return { text: last.toFormat("LLL d"), tone: "faint", past: true };
}

export function whenLine(activity: PersonActivity, now: DateTime): WhenLine {
  switch (activity.kind) {
    case "upcoming": {
      const { start } = activity.next;
      const days = daysAhead(start, now);
      if (days <= 0) return { text: start.toFormat("h:mma").toLowerCase(), tone: "accent", past: false };
      if (days < WEEK_DAYS) return { text: start.toFormat("ccc"), tone: "muted", past: false };
      return { text: start.toFormat("LLL d"), tone: "muted", past: false };
    }
    case "recent":
      return lastLine(activity.last.start);
    case "inactive":
      return activity.last.some
        ? lastLine(activity.last.val.start)
        : { text: "No sessions", tone: "faint", past: false };
    default: {
      const _exhaustive: never = activity;
      throw new Error(`Unhandled person activity: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function sortKey(activity: PersonActivity): [number, number] {
  switch (activity.kind) {
    case "upcoming":
      return [0, activity.next.start.toMillis()];
    case "recent":
      return [1, -activity.last.start.toMillis()];
    case "inactive":
      return [2, activity.last.some ? -activity.last.val.start.toMillis() : Infinity];
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
