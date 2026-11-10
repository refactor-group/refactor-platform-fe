import type { DateTime } from "ts-luxon";
import { busyOn, suggestTimes, type BusyClash, type BusySession } from "@/lib/scheduling";
import { busySessions, clashFor } from "@/lib/schedule-draft";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { type Option, None, Some } from "@/types/option";
import type { MoveSlotsContext } from "./slots";

export interface MoveChoices {
  suggestionsFor: (day: DateTime) => DateTime[];
  busyOn: (day: DateTime) => BusySession[];
  clashAt: (start: DateTime) => Option<BusyClash>;
  /** Whether the whole session at `start` falls where sessions are loaded, so its overlaps are known. */
  covers: (start: DateTime) => boolean;
}

export type MoveChoicesContext = MoveSlotsContext & { known: { from: DateTime; to: DateTime } };

/** The times offered for moving `session`, checked against the other loaded sessions. */
export function moveChoices(session: EnrichedCoachingSession, context: MoveChoicesContext): MoveChoices {
  const { sessions, viewerId, timezone, hours, now, known } = context;
  const [moving] = busySessions([session], viewerId, timezone);
  const others = busySessions(sessions, viewerId, timezone).filter((b) => b.id !== moving.id);
  const minutes = moving.end.diff(moving.start, "minutes").minutes;
  const usual = Some({ weekday: moving.start.weekday, minute: moving.start.hour * 60 + moving.start.minute });
  const isCurrent = (start: DateTime) => start.toMillis() === moving.start.toMillis();
  return {
    suggestionsFor: (day) =>
      suggestTimes({ day, minutes, usual, coachStarts: [], busy: others, hours, now }).filter((t) => !isCurrent(t)),
    busyOn: (day) => busyOn(others, day, None),
    clashAt: (start) => clashFor({ start, minutes }, others, hours),
    covers: (start) => start >= known.from && start.plus({ minutes }) <= known.to,
  };
}
