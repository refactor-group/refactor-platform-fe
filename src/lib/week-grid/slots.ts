import type { DateTime } from "ts-luxon";
import {
  SLOT_STEP_MINUTES,
  atMinute,
  overlapping,
  type BusySession,
  type Slot,
  type WorkingHours,
} from "@/lib/scheduling";
import { busySessions } from "@/lib/schedule-draft";
import { firstNameOf } from "@/lib/scheduling-copy";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import type { Option } from "@/types/option";

export type SlotState =
  | { kind: "free" }
  | { kind: "taken"; holder: string }
  | { kind: "current" }
  | { kind: "past" };

export interface DaySlot {
  start: DateTime;
  state: SlotState;
}

/** What a drop target carries in its `data`. */
export type DropTarget = { kind: "day"; day: DateTime } | { kind: "slot"; slot: DaySlot };

export interface DaySlotsInput {
  day: DateTime;
  moving: BusySession;
  busy: BusySession[];
  hours: WorkingHours;
  now: DateTime;
}

function workingStarts(day: DateTime, hours: WorkingHours, minutes: number): DateTime[] {
  const starts: DateTime[] = [];
  for (let minute = hours.start; minute + minutes <= hours.end; minute += SLOT_STEP_MINUTES) {
    starts.push(atMinute(day, minute));
  }
  return starts;
}

function withCurrent(starts: DateTime[], day: DateTime, current: DateTime): DateTime[] {
  const onDay = current.setZone(day.zone).hasSame(day, "day");
  if (!onDay || starts.some((s) => s.toMillis() === current.toMillis())) return starts;
  return [...starts, current].sort((a, b) => a.toMillis() - b.toMillis());
}

function stateOf(slot: Slot, input: DaySlotsInput, others: BusySession[]): SlotState {
  if (slot.start.toMillis() === input.moving.start.toMillis()) return { kind: "current" };
  if (slot.start < input.now) return { kind: "past" };
  const [holder] = overlapping(slot, others);
  return holder ? { kind: "taken", holder: firstNameOf(holder.personName) } : { kind: "free" };
}

export function daySlots(input: DaySlotsInput): DaySlot[] {
  const { day, moving, busy, hours } = input;
  const minutes = moving.end.diff(moving.start, "minutes").minutes;
  const others = busy.filter((b) => b.id !== moving.id);
  return withCurrent(workingStarts(day, hours, minutes), day, moving.start).map((start) => ({
    start,
    state: stateOf({ start, minutes }, input, others),
  }));
}

export interface MoveSlotsContext {
  sessions: EnrichedCoachingSession[];
  viewerId: Id;
  timezone: string;
  hours: WorkingHours;
  now: DateTime;
}

/** Each day's slots for moving `session` among the loaded `sessions`. */
export function slotsForMove(session: EnrichedCoachingSession, context: MoveSlotsContext): (day: DateTime) => DaySlot[] {
  const { sessions, viewerId, timezone, hours, now } = context;
  const busy = busySessions(sessions, viewerId, timezone);
  const [moving] = busySessions([session], viewerId, timezone);
  return (day) => daySlots({ day, moving, busy, hours, now });
}

export type DropOutcome = { kind: "move"; start: DateTime } | { kind: "resolve"; start: DateTime } | { kind: "ignore" };

const IGNORE: DropOutcome = { kind: "ignore" };

export function dropOutcome(slot: DaySlot): DropOutcome {
  const { start, state } = slot;
  switch (state.kind) {
    case "free":
      return { kind: "move", start };
    case "taken":
      return { kind: "resolve", start };
    case "current":
    case "past":
      return { kind: "ignore" };
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled slot state: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** What dropping on `target` does; anything but a slot is ignored. */
export function targetOutcome(target: Option<DropTarget>): DropOutcome {
  return target.some && target.val.kind === "slot" ? dropOutcome(target.val.slot) : IGNORE;
}

/** A drop that never moved, like Space then Space, changes nothing. */
export function settledOutcome(outcome: DropOutcome, delta: { x: number; y: number }): DropOutcome {
  return delta.x === 0 && delta.y === 0 ? IGNORE : outcome;
}
