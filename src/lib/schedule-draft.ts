import { DateTime } from "ts-luxon";
import type { PickerPerson } from "@/components/ui/new-session/person-picker";
import type { StepRailItem } from "@/components/ui/step-dialog";
import type { PersonEntry } from "@/lib/people";
import { byActivity, isInactive, personActivity } from "@/lib/person-activity";
import {
  type BusyClash,
  type BusySession,
  type RepeatChoice,
  type Slot,
  type UsualSlot,
  type WorkingHours,
  MoveScope,
  StepKind,
  currentStep,
  freeSlots,
  nextFreeStart,
  overlapping,
  usualSlot,
} from "@/lib/scheduling";
import { firstNameOf, moveScopeTitle, repeatLabel, shortDay, whoSubline } from "@/lib/scheduling-copy";
import { seriesSlotStart, sessionEndIn, sessionStartIn, timeOfDay, toSessionDate } from "@/lib/session-window";
import { formatWeekdayDate } from "@/lib/utils/date";
import {
  type CoachingSession,
  type EnrichedCoachingSession,
  defaultCoachingSession,
} from "@/types/coaching-session";
import { coachingSessionTitle, enrichedTitleSource } from "@/types/coaching-session-title";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import type { Provider } from "@/types/provider";
import {
  type CreateRecurringSessionRequest,
  Frequency,
  MAX_SPAN_DAYS,
  type Recurrence,
  type RecurrenceEnd,
  WEEKDAYS_ORDERED,
  type Weekday,
  recurrenceToPayload,
  untilDateToUtcDateTime,
  weekdayFromLuxon,
} from "@/types/recurrence";
import type { User } from "@/types/user";

/** How the user settles an overlap with another session. */
export type Resolution =
  | { kind: "unresolved" }
  | { kind: "move"; start: DateTime }
  | { kind: "keep" };

const MISSING_HINT = "Choose a person, date and time to schedule.";

/** Whether the busy read for the shown range has come back. */
export type Availability = { kind: "loading" } | { kind: "error" } | { kind: "loaded" };

/** Until the busy read is in, an empty calendar would read as free. */
export function availabilityHint(availability: Availability): Option<string> {
  switch (availability.kind) {
    case "loading":
      return Some("Checking your calendar…");
    case "error":
      return Some("Couldn't check your calendar. Close and try again.");
    case "loaded":
      return None;
    default: {
      const _exhaustive: never = availability;
      throw new Error(`Unhandled availability: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// ─── Sessions ────────────────────────────────────────────────────────

interface Placed {
  session: EnrichedCoachingSession;
  start: DateTime;
  over: boolean;
}

function place(session: EnrichedCoachingSession, now: DateTime, timezone: string): Placed {
  return {
    session,
    start: sessionStartIn(session.date, timezone),
    over: sessionEndIn(session, timezone) <= now,
  };
}

function fullName(user: User): string {
  return `${user.first_name} ${user.last_name}`.trim();
}

function otherName(session: EnrichedCoachingSession, userId: Id): string {
  const other = session.relationship?.coach_id === userId ? session.coachee : session.coach;
  return other ? fullName(other) : coachingSessionTitle(enrichedTitleSource(session));
}

export function busySessions(
  sessions: EnrichedCoachingSession[],
  userId: Id,
  timezone: string
): BusySession[] {
  return sessions.map((session) => ({
    id: session.id,
    personName: otherName(session, userId),
    start: sessionStartIn(session.date, timezone),
    end: sessionEndIn(session, timezone),
  }));
}

/** Every session from both reads, once each. */
export function knownSessions(
  nearest: Option<EnrichedCoachingSession[]>,
  history: EnrichedCoachingSession[]
): EnrichedCoachingSession[] {
  const byId = new Map<Id, EnrichedCoachingSession>();
  for (const session of [...(nearest.some ? nearest.val : []), ...history]) {
    if (!byId.has(session.id)) byId.set(session.id, session);
  }
  return [...byId.values()];
}

function placeAll(sessions: EnrichedCoachingSession[], now: DateTime, timezone: string): Placed[] {
  return sessions.map((s) => place(s, now, timezone)).sort((a, b) => a.start.toMillis() - b.start.toMillis());
}

function placedFor(
  relationshipIds: Id[],
  sessions: EnrichedCoachingSession[],
  now: DateTime,
  timezone: string
): Placed[] {
  return placeAll(
    sessions.filter((s) => relationshipIds.includes(s.coaching_relationship_id)),
    now,
    timezone
  );
}

function usualOf(placed: Placed[], timezone: string): Option<UsualSlot> {
  const series = placed.find((p) => !p.over && p.session.coaching_session_series_id.some);
  const history = placed.filter((p) => p.over).map((p) => p.start);
  return usualSlot(series ? Some(seriesSlotStart(series.session, timezone)) : None, history);
}

export function usualFor(
  relationshipIds: Id[],
  sessions: EnrichedCoachingSession[],
  now: DateTime,
  timezone: string
): Option<UsualSlot> {
  return usualOf(placedFor(relationshipIds, sessions, now, timezone), timezone);
}

// ─── Who ─────────────────────────────────────────────────────────────

interface PickerPeopleInput {
  people: PersonEntry[];
  nearest: Option<EnrichedCoachingSession[]>;
  history: EnrichedCoachingSession[];
  now: DateTime;
  timezone: string;
}

function startOf(placed: Placed | undefined): Option<DateTime> {
  return placed ? Some(placed.start) : None;
}

/** Each person's sessions in one pass, in the given order. */
function sessionsPerPerson(people: PersonEntry[], sessions: EnrichedCoachingSession[]): EnrichedCoachingSession[][] {
  const owners = new Map<Id, Set<number>>();
  people.forEach((entry, i) =>
    entry.relationshipIds.forEach((id) => owners.set(id, (owners.get(id) ?? new Set<number>()).add(i)))
  );
  const own = people.map((): EnrichedCoachingSession[] => []);
  for (const s of sessions) owners.get(s.coaching_relationship_id)?.forEach((i) => own[i].push(s));
  return own;
}

export function pickerPeople(input: PickerPeopleInput): PickerPerson[] {
  const { people, nearest, now, timezone } = input;
  const own = sessionsPerPerson(people, knownSessions(nearest, input.history));
  const entries = people.map((entry, i) => {
    const placed = placeAll(own[i], now, timezone);
    const subline = whoSubline(
      {
        usual: usualOf(placed, timezone),
        next: startOf(placed.find((p) => !p.over)),
        last: startOf(placed.filter((p) => p.over).at(-1)),
      },
      now
    );
    const activity = personActivity(
      placed.map((p) => ({ start: p.start, over: p.over, relationshipId: p.session.coaching_relationship_id })),
      now
    );
    const { userId, fullName: name, initials } = entry.person;
    return { person: { userId, fullName: name, initials, subline, inactive: false }, activity };
  });
  if (nearest.none) return entries.map((e) => e.person);
  return byActivity(entries, (e) => e.activity).map((e) => ({ ...e.person, inactive: isInactive(e.activity) }));
}

// ─── When ────────────────────────────────────────────────────────────

const WEEK_DAYS = 7;

function atMinute(day: DateTime, minute: number): DateTime {
  return day.startOf("day").set({ hour: Math.floor(minute / 60), minute: minute % 60 });
}

function nextUsualDay(usual: UsualSlot, now: DateTime): Option<DateTime> {
  const today = now.startOf("day");
  for (let offset = 0; offset <= WEEK_DAYS; offset += 1) {
    const day = today.plus({ days: offset });
    if (day.weekday === usual.weekday && atMinute(day, usual.minute) >= now) return Some(day);
  }
  return None;
}

function prefillDay(requested: Option<DateTime>, usual: Option<UsualSlot>, now: DateTime): Option<DateTime> {
  if (requested.some) return Some(requested.val.startOf("day"));
  return usual.some ? nextUsualDay(usual.val, now) : None;
}

interface PrefillInput {
  requested: Option<DateTime>;
  usual: Option<UsualSlot>;
  busy: BusySession[];
  minutes: number;
  now: DateTime;
}

export function prefillWhen(input: PrefillInput): { day: Option<DateTime>; time: Option<string> } {
  const { usual, busy, minutes, now } = input;
  const day = prefillDay(input.requested, usual, now);
  if (day.none || usual.none) return { day, time: None };
  const start = atMinute(day.val, usual.val.minute);
  const free = start >= now && overlapping({ start, minutes }, busy).length === 0;
  return { day, time: free ? Some(start.toFormat("HH:mm")) : None };
}

/** The busy read's range: the shown month's whole weeks, stretched to the selected day's week. */
export function busyWindow(month: DateTime, selected: Option<DateTime>): { from: DateTime; to: DateTime } {
  const from = month.startOf("month").startOf("week");
  const to = month.endOf("month").endOf("week");
  if (selected.none) return { from, to };
  return {
    from: DateTime.min(from, selected.val.startOf("week")),
    to: DateTime.max(to, selected.val.endOf("week")),
  };
}

export function clashFor(slot: Slot, busy: BusySession[], hours: WorkingHours): Option<BusyClash> {
  const [first, ...others] = overlapping(slot, busy);
  if (!first) return None;
  return Some({ session: first, others, instead: nextFreeStart(slot, busy, hours) });
}

// ─── Resolve overlap ─────────────────────────────────────────────────

export function resolveDays(clashDay: DateTime, now: DateTime): { day: DateTime; past: boolean }[] {
  const monday = clashDay.startOf("week");
  const today = now.setZone(clashDay.zone).startOf("day");
  return Array.from({ length: WEEK_DAYS }, (_, index) => {
    const day = monday.plus({ days: index });
    return { day, past: day < today };
  });
}

interface ResolveSlotsInput {
  day: DateTime;
  clash: BusySession;
  newSlot: Slot;
  busy: BusySession[];
  hours: WorkingHours;
  now: DateTime;
}

export function resolveSlots(input: ResolveSlotsInput): DateTime[] {
  const { day, clash, newSlot, busy, hours, now } = input;
  const asBusy: BusySession = {
    id: `new:${newSlot.start.toMillis()}`,
    personName: "",
    start: newSlot.start,
    end: newSlot.start.plus({ minutes: newSlot.minutes }),
  };
  const others = [...busy.filter((b) => b.id !== clash.id), asBusy];
  const minutes = clash.end.diff(clash.start, "minutes").minutes;
  return freeSlots(day, others, minutes, hours, now);
}

// ─── Repeat ──────────────────────────────────────────────────────────

interface OccurrenceInput {
  start: DateTime;
  frequency: Frequency;
  byWeekdays: Weekday[];
  end: RecurrenceEnd;
}

function weeksBetween(a: DateTime, b: DateTime): number {
  return Math.round(b.startOf("week").diff(a.startOf("week"), "weeks").weeks);
}

function occursOn(day: DateTime, input: OccurrenceInput): boolean {
  const { start, frequency, byWeekdays } = input;
  switch (frequency) {
    case Frequency.Daily:
      return true;
    case Frequency.Weekly:
      return byWeekdays.includes(weekdayFromLuxon(day.weekday));
    case Frequency.Biweekly:
      return byWeekdays.includes(weekdayFromLuxon(day.weekday)) && weeksBetween(start, day) % 2 === 0;
    case Frequency.Monthly:
      return day.day === start.day;
    default: {
      const _exhaustive: never = frequency;
      throw new Error(`Unhandled frequency: ${_exhaustive}`);
    }
  }
}

/** Moves a series' start weekday to the new one, keeping the other chosen days. */
export function swapStartWeekday(days: Weekday[], from: Weekday, to: Weekday): Weekday[] {
  if (!days.includes(from)) return days;
  const next = [...days.filter((d) => d !== from), to];
  return WEEKDAYS_ORDERED.filter((d) => next.includes(d));
}

// Past the backend's span cap the series is invalid anyway; stop walking there.
function* occurrenceDays(input: OccurrenceInput): Generator<DateTime> {
  const first = input.start.startOf("day");
  for (let offset = 0; offset < MAX_SPAN_DAYS + 1; offset += 1) {
    const day = first.plus({ days: offset });
    if (occursOn(day, input)) yield day;
  }
}

export function occurrenceCount(input: OccurrenceInput): number {
  const { start, end } = input;
  if (end.kind === "count") return end.count;
  const until = DateTime.fromISO(end.until, { zone: start.zone }).startOf("day");
  if (!until.isValid) return 0;
  let count = 0;
  for (const day of occurrenceDays(input)) {
    if (day > until) break;
    count += 1;
  }
  return count;
}

export function lastOccurrence(input: OccurrenceInput): Option<DateTime> {
  const { start, end } = input;
  if (end.kind !== "count" || !Number.isInteger(end.count) || end.count < 1) return None;
  let seen = 0;
  for (const day of occurrenceDays(input)) {
    seen += 1;
    if (seen === end.count) {
      return Some(day.set({ hour: start.hour, minute: start.minute, second: start.second, millisecond: start.millisecond }));
    }
  }
  return None;
}

export function lastSessionText(last: DateTime, start: DateTime): string {
  const format = last.year === start.year ? "ccc, LLL d" : "ccc, LLL d, yyyy";
  return `the last on ${last.toFormat(format)}`;
}

// ─── Payloads ────────────────────────────────────────────────────────

export function sessionPayload(input: {
  relationshipId: Id;
  start: DateTime;
  minutes: number;
  provider: Option<Provider>;
}): CoachingSession {
  return {
    ...defaultCoachingSession(),
    coaching_relationship_id: input.relationshipId,
    date: toSessionDate(input.start),
    duration_minutes: input.minutes,
    provider: input.provider.some ? input.provider.val : undefined,
  };
}

/** A series rule as the wire wants it, with `until` as the naive-UTC end of that day. */
export interface RuleInput {
  frequency: Frequency;
  interval: number;
  byWeekdays: Weekday[];
  end: RecurrenceEnd;
  timezone: string;
}

export function rulePayload({ frequency, interval, byWeekdays, end, timezone }: RuleInput): Recurrence {
  const wireEnd: RecurrenceEnd =
    end.kind === "until" ? { kind: "until", until: untilDateToUtcDateTime(end.until, timezone) } : end;
  return recurrenceToPayload(frequency, interval, byWeekdays, wireEnd);
}

export function seriesPayload(
  input: RuleInput & { relationshipId: Id; start: DateTime; minutes: number }
): CreateRecurringSessionRequest {
  return {
    coaching_relationship_id: input.relationshipId,
    start_at: toSessionDate(input.start),
    duration_minutes: input.minutes,
    recurrence: rulePayload(input),
  };
}

// ─── Rail and hint ───────────────────────────────────────────────────

/** An overlap and how far it's settled. */
export interface ClashState {
  clash: Option<BusySession>;
  /** The clashing session isn't the user's to move, or there are several, so it can only be kept. */
  keepOnly: boolean;
  /** The new time overlaps more than one session. */
  several: boolean;
  resolution: Resolution;
}

/** What "keep" keeps: "both" sessions, or "all" of them. */
export function keptWord(several: boolean): string {
  return several ? "all" : "both";
}

interface ScheduleRailInput extends ClashState {
  order: StepKind[];
  step: StepKind;
  personName: Option<string>;
  start: Option<DateTime>;
  repeat: RepeatChoice;
}

/** The rail for any mode; `whenDone` is when the When row gets its check. */
export interface StepRailInput extends ScheduleRailInput {
  whenDone: boolean;
  scope: MoveScope;
}

function startLine(start: DateTime): string {
  return `${formatWeekdayDate(start)}, ${timeOfDay(start)}`;
}

function resolutionValue(input: StepRailInput): string {
  const { clash, keepOnly, several, resolution, start } = input;
  const kept = keptWord(several);
  if (clash.none) return "Choose a new time";
  const first = firstNameOf(clash.val.personName);
  switch (resolution.kind) {
    case "unresolved":
      return keepOnly ? `Keep ${kept} or pick another time` : `Choose a new time for ${first}`;
    case "move":
      return `Move ${first} to ${shortDay(resolution.start)}, ${timeOfDay(resolution.start)}`;
    case "keep":
      return start.some ? `Keep ${kept} at ${timeOfDay(start.val)}` : `Keep ${kept}`;
    default: {
      const _exhaustive: never = resolution;
      throw new Error(`Unhandled resolution: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function railRow(kind: StepKind, input: StepRailInput, current: StepKind): Omit<StepRailItem, "id" | "current"> {
  const { order, personName, start, repeat, resolution } = input;
  switch (kind) {
    case StepKind.Who:
      return { label: "Who", value: personName.some ? personName.val : "Choose a person", done: personName.some };
    case StepKind.When:
      return { label: "When", value: start.some ? startLine(start.val) : "Set a date and time", done: input.whenDone };
    case StepKind.Repeat:
      return {
        label: "Repeats",
        value: repeatLabel(repeat),
        done: repeat.kind === "repeat" || order.indexOf(kind) < order.indexOf(current),
      };
    case StepKind.Resolve:
      return { label: "Resolve overlap", value: resolutionValue(input), done: resolution.kind !== "unresolved" };
    case StepKind.AppliesTo:
      return {
        label: "Applies to",
        value: moveScopeTitle(input.scope),
        done: order.indexOf(kind) < order.indexOf(current),
      };
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unhandled step: ${_exhaustive}`);
    }
  }
}

export function stepRail(input: StepRailInput): StepRailItem[] {
  const current = currentStep(input.order, input.step);
  return input.order.map((kind) => ({ id: kind, ...railRow(kind, input, current), current: kind === current }));
}

export function scheduleRail(input: ScheduleRailInput): StepRailItem[] {
  return stepRail({ ...input, whenDone: input.start.some, scope: MoveScope.This });
}

/** Asks how to settle an overlap that's still open. */
export function resolveHint({ clash, keepOnly, several, resolution }: ClashState): Option<string> {
  if (clash.none || resolution.kind !== "unresolved") return None;
  return Some(
    keepOnly
      ? `Keep ${keptWord(several)}, or go back and pick another time.`
      : `Pick a new time for ${firstNameOf(clash.val.personName)}, or keep both.`
  );
}

export function scheduleHint(
  input: ClashState & { personName: Option<string>; start: Option<DateTime>; availability: Availability }
): Option<string> {
  if (input.personName.none || input.start.none) return Some(MISSING_HINT);
  const checking = availabilityHint(input.availability);
  return checking.some ? checking : resolveHint(input);
}
