import type { DateTime } from "ts-luxon";
import {
  SLOT_STEP_MINUTES,
  atMinute,
  overlapping,
  type BusySession,
  type Slot,
  type WorkingHours,
} from "@/lib/scheduling";
import { firstNameOf } from "@/lib/scheduling-copy";

export type SlotState =
  | { kind: "free" }
  | { kind: "taken"; holder: string }
  | { kind: "current" }
  | { kind: "past" };

export interface DaySlot {
  start: DateTime;
  state: SlotState;
}

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
