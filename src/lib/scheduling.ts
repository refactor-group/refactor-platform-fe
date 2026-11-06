import type { DateTime } from "ts-luxon";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import type { Frequency, RecurrenceEnd } from "@/types/recurrence";

export interface BusySession {
  id: Id;
  personName: string;
  start: DateTime;
  end: DateTime;
}

/** Minutes after local midnight. */
export interface WorkingHours {
  start: number;
  end: number;
}

export const DEFAULT_WORKING_HOURS: WorkingHours = { start: 9 * 60, end: 17 * 60 };
// The backend's default until user hours are read.
export const USER_WORKING_HOURS_FALLBACK: WorkingHours = { start: 8 * 60, end: 17 * 60 + 30 };

export interface BusyClash {
  session: BusySession;
  /** Any further sessions the new time also overlaps. */
  others: BusySession[];
  instead: Option<DateTime>;
}

export interface Slot {
  start: DateTime;
  minutes: number;
}

/** `weekday` is Luxon's, 1 = Monday through 7 = Sunday. */
export interface UsualSlot {
  weekday: number;
  minute: number;
}

/** How often a series repeats: every `interval` of `frequency`. */
export interface Cadence {
  frequency: Frequency;
  interval: number;
}

export type RepeatChoice = { kind: "none" } | ({ kind: "repeat"; end: RecurrenceEnd } & Cadence);

export const SLOT_STEP_MINUTES = 30;
const MAX_SUGGESTIONS = 5;
/** A start time counts as a habit once it has been used this many times. */
const MIN_REPEATS = 2;

function byStart<T extends { start: DateTime }>(a: T, b: T): number {
  return a.start.toMillis() - b.start.toMillis();
}

function chronological(a: DateTime, b: DateTime): number {
  return a.toMillis() - b.toMillis();
}

function minuteOfDay(dt: DateTime): number {
  return dt.hour * 60 + dt.minute;
}

/** `minute` past midnight on `day`'s local date, in its zone. */
export function atMinute(day: DateTime, minute: number): DateTime {
  return day.startOf("day").set({ hour: Math.floor(minute / 60), minute: minute % 60 });
}

function endOf(slot: Slot): DateTime {
  return slot.start.plus({ minutes: slot.minutes });
}

export function busyOn(busy: BusySession[], day: DateTime, exclude: Option<Id>): BusySession[] {
  return busy
    .filter((b) => b.start.setZone(day.zone).hasSame(day, "day"))
    .filter((b) => !(exclude.some && b.id === exclude.val))
    .sort(byStart);
}

export function overlapping(slot: Slot, busy: BusySession[]): BusySession[] {
  const end = endOf(slot);
  return busy.filter((b) => slot.start < b.end && end > b.start).sort(byStart);
}

/** A slot already past the working day may look until midnight. */
function searchLimit(slot: Slot, hours: WorkingHours): DateTime {
  const workEnd = atMinute(slot.start, hours.end);
  return endOf(slot) > workEnd ? slot.start.startOf("day").plus({ days: 1 }) : workEnd;
}

export function nextFreeStart(slot: Slot, busy: BusySession[], hours: WorkingHours): Option<DateTime> {
  const dayEnd = searchLimit(slot, hours);
  for (let offset = SLOT_STEP_MINUTES; ; offset += SLOT_STEP_MINUTES) {
    const candidate = { start: slot.start.plus({ minutes: offset }), minutes: slot.minutes };
    if (endOf(candidate) > dayEnd) return None;
    if (overlapping(candidate, busy).length === 0) return Some(candidate.start);
  }
}

export function freeSlots(
  day: DateTime,
  busy: BusySession[],
  minutes: number,
  hours: WorkingHours,
  now: DateTime
): DateTime[] {
  const starts: DateTime[] = [];
  for (let minute = hours.start; minute + minutes <= hours.end; minute += SLOT_STEP_MINUTES) {
    const slot = { start: atMinute(day, minute), minutes };
    if (slot.start >= now && overlapping(slot, busy).length === 0) starts.push(slot.start);
  }
  return starts;
}

interface SlotTally {
  slot: UsualSlot;
  count: number;
  latest: DateTime;
}

function tallySlots(history: DateTime[]): SlotTally[] {
  const tallies = new Map<string, SlotTally>();
  for (const start of history) {
    const slot = { weekday: start.weekday, minute: minuteOfDay(start) };
    const key = `${slot.weekday}:${slot.minute}`;
    const tally = tallies.get(key);
    if (!tally) tallies.set(key, { slot, count: 1, latest: start });
    else {
      tally.count += 1;
      if (start > tally.latest) tally.latest = start;
    }
  }
  return [...tallies.values()];
}

export function usualSlot(seriesStart: Option<DateTime>, history: DateTime[]): Option<UsualSlot> {
  if (seriesStart.some) {
    return Some({ weekday: seriesStart.val.weekday, minute: minuteOfDay(seriesStart.val) });
  }
  const [top] = tallySlots(history)
    .filter((t) => t.count >= MIN_REPEATS)
    .sort((a, b) => b.count - a.count || b.latest.toMillis() - a.latest.toMillis());
  return top ? Some(top.slot) : None;
}

export interface SuggestTimesInput {
  day: DateTime;
  minutes: number;
  usual: Option<UsualSlot>;
  coachStarts: DateTime[];
  busy: BusySession[];
  hours: WorkingHours;
  now: DateTime;
}

/** The coach's start times of day seen at least twice, most frequent first, ties earlier first. */
function frequentMinutes(starts: DateTime[]): number[] {
  const counts = new Map<number, number>();
  for (const start of starts) {
    const minute = minuteOfDay(start);
    counts.set(minute, (counts.get(minute) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= MIN_REPEATS)
    .sort(([ma, ca], [mb, cb]) => cb - ca || ma - mb)
    .map(([m]) => m);
}

function roundHourMinutes(minutes: number, hours: WorkingHours): number[] {
  const result: number[] = [];
  for (let minute = Math.ceil(hours.start / 60) * 60; minute + minutes <= hours.end; minute += 60) {
    result.push(minute);
  }
  return result;
}

export function suggestTimes(input: SuggestTimesInput): DateTime[] {
  const { day, minutes, usual, coachStarts, busy, hours, now } = input;
  const candidates = [
    ...(usual.some ? [usual.val.minute] : []),
    ...frequentMinutes(coachStarts),
    ...roundHourMinutes(minutes, hours),
  ];
  const seen = new Set<number>();
  const kept: DateTime[] = [];
  for (const minute of candidates) {
    const start = atMinute(day, minute);
    if (start < now || seen.has(start.toMillis())) continue;
    // All of busy, not just the day's: a session can cross midnight either way.
    if (overlapping({ start, minutes }, busy).length > 0) continue;
    seen.add(start.toMillis());
    kept.push(start);
    if (kept.length === MAX_SUGGESTIONS) break;
  }
  return kept.sort(chronological);
}

export enum StepKind {
  Who = "who",
  When = "when",
  Repeat = "repeat",
  AppliesTo = "applies_to",
  Resolve = "resolve",
}

export enum MoveScope {
  This = "this",
  Following = "following",
}

export type StepMode = { kind: "schedule" } | { kind: "move"; appliesTo: boolean; following: boolean };

function baseSteps(mode: StepMode): StepKind[] {
  switch (mode.kind) {
    case "schedule":
      return [StepKind.Who, StepKind.When, StepKind.Repeat];
    case "move":
      if (!mode.appliesTo) return [StepKind.When];
      return mode.following ? [StepKind.When, StepKind.AppliesTo, StepKind.Repeat] : [StepKind.When, StepKind.AppliesTo];
    default: {
      const _exhaustive: never = mode;
      throw new Error(`Unhandled step mode: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function stepOrder(mode: StepMode, clash: boolean): StepKind[] {
  const steps = baseSteps(mode);
  return clash ? [...steps, StepKind.Resolve] : steps;
}

export function currentStep(order: StepKind[], step: StepKind): StepKind {
  return order.includes(step) ? step : order[order.length - 1];
}

export function stepPosition(order: StepKind[], step: StepKind): { index: number; total: number } {
  return { index: order.indexOf(currentStep(order, step)) + 1, total: order.length };
}

function stepAt(order: StepKind[], index: number): Option<StepKind> {
  return index >= 0 && index < order.length ? Some(order[index]) : None;
}

export function nextStep(order: StepKind[], step: StepKind): Option<StepKind> {
  const index = order.indexOf(step);
  return index < 0 ? None : stepAt(order, index + 1);
}

export function prevStep(order: StepKind[], step: StepKind): Option<StepKind> {
  const index = order.indexOf(step);
  return index < 0 ? None : stepAt(order, index - 1);
}
