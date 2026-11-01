import type { DateTime } from "ts-luxon";
import type {
  DotKind,
  Liveness,
  MenuSession,
  MonthGroup,
} from "@/components/ui/join-session/types";
import type { Id } from "@/types/general";
import type { Option } from "@/types/option";
import { SessionUrgency } from "@/types/session-display";

export interface WindowInput {
  sessions: MenuSession[];
  today: Option<Id>;
  current: Option<Id>;
  now: DateTime;
}

export interface SessionWindow {
  list: MenuSession[];
  dots: MenuSession[];
}

const SIDE = 2;

export function livenessFromUrgency(urgency: SessionUrgency): Liveness {
  switch (urgency) {
    case SessionUrgency.Underway:
      return "live";
    case SessionUrgency.Imminent:
      return "soon";
    case SessionUrgency.Soon:
    case SessionUrgency.Later:
    case SessionUrgency.Past:
      return "none";
    default: {
      const _exhaustive: never = urgency;
      throw new Error(`Unhandled session urgency: ${_exhaustive}`);
    }
  }
}

function newestFirst(sessions: MenuSession[]): MenuSession[] {
  return [...sessions].sort((a, b) => b.start.toMillis() - a.start.toMillis());
}

function indexOf(sorted: MenuSession[], id: Option<Id>): number {
  return id.some ? sorted.findIndex((s) => s.id === id.val) : -1;
}

function newerThan(sorted: MenuSession[], index: number): MenuSession[] {
  return sorted.slice(Math.max(0, index - SIDE), index);
}

function olderThan(sorted: MenuSession[], index: number): MenuSession[] {
  return sorted.slice(index + 1, index + 1 + SIDE);
}

function aroundNow(sorted: MenuSession[], now: DateTime): MenuSession[] {
  const nowMs = now.toMillis();
  const upcoming = sorted.filter((s) => s.start.toMillis() >= nowMs);
  const past = sorted.filter((s) => s.start.toMillis() < nowMs);
  return [...upcoming.slice(-SIDE), ...past.slice(0, SIDE)];
}

function oldestFirst(sessions: MenuSession[]): MenuSession[] {
  return [...sessions].reverse();
}

export function sessionWindow(input: WindowInput): SessionWindow {
  const sorted = newestFirst(input.sessions);

  const todayIndex = indexOf(sorted, input.today);
  if (todayIndex >= 0) {
    const newer = newerThan(sorted, todayIndex);
    const older = olderThan(sorted, todayIndex);
    return {
      list: [...newer, ...older],
      dots: oldestFirst([...newer, sorted[todayIndex], ...older]),
    };
  }

  const currentIndex = indexOf(sorted, input.current);
  const list =
    currentIndex >= 0
      ? [
          ...newerThan(sorted, currentIndex),
          sorted[currentIndex],
          ...olderThan(sorted, currentIndex),
        ]
      : aroundNow(sorted, input.now);
  return { list, dots: oldestFirst(list) };
}

function matches(id: Option<Id>, session: MenuSession): boolean {
  return id.some && id.val === session.id;
}

export function dotKind(
  session: MenuSession,
  input: Pick<WindowInput, "today" | "current" | "now">
): DotKind {
  if (matches(input.current, session)) return "current";
  if (matches(input.today, session)) return "today";
  return session.start.toMillis() >= input.now.toMillis() ? "upcoming" : "past";
}

function sameMonth(a: DateTime, b: DateTime): boolean {
  return a.year === b.year && a.month === b.month;
}

export function monthGroups(
  dots: MenuSession[],
  anchor: DateTime
): MonthGroup[] {
  return dots.reduce<MonthGroup[]>((groups, session) => {
    const key = session.start.toFormat("yyyy-MM");
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.sessions.push(session);
      return groups;
    }
    groups.push({
      key,
      label: session.start.toFormat("LLL"),
      selected: sameMonth(session.start, anchor),
      sessions: [session],
    });
    return groups;
  }, []);
}

export function listDate(dt: DateTime): string {
  return dt.toFormat("ccc LLL d");
}

export function shortDate(dt: DateTime): string {
  return dt.toFormat("LLL d");
}

export function timeOfDay(dt: DateTime): string {
  return dt.toFormat("h:mm a");
}
