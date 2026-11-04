import type { DateTime } from "ts-luxon";
import type { PickerPerson } from "@/components/ui/new-session/person-picker";
import type { StepDialogLead, StepRailItem } from "@/components/ui/step-dialog";
import type { ScheduleData } from "@/lib/hooks/use-schedule-data";
import { moveStart } from "@/lib/move-draft";
import type { PersonEntry } from "@/lib/people";
import { type Resolution, occurrenceCount, resolveDays, resolveSlots, usualFor } from "@/lib/schedule-draft";
import {
  type BusyClash,
  type BusySession,
  type Cadence,
  DEFAULT_WORKING_HOURS,
  type MoveScope,
  type RepeatChoice,
  StepKind,
  type UsualSlot,
} from "@/lib/scheduling";
import { currentlyLine, overlapsNewLine, overlapsNewLines, resolveSubline } from "@/lib/scheduling-copy";
import { sessionStartIn } from "@/lib/session-window";
import type { NewSessionRequest } from "@/lib/stores/new-session-dialog-store";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import type { Provider } from "@/types/provider";
import { Frequency, type RecurrenceEnd, type Weekday } from "@/types/recurrence";

export const UNRESOLVED: Resolution = { kind: "unresolved" };

export type WhoState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "empty" }
  | { kind: "ready"; people: PickerPerson[] };

export interface WhoModel {
  state: WhoState;
  selectedId: Option<Id>;
  onSelect: (userId: Id) => void;
}

export interface WhenModel {
  month: DateTime;
  today: DateTime;
  day: Option<DateTime>;
  busy: BusySession[];
  dayBusy: BusySession[];
  clash: Option<BusyClash>;
  suggestions: DateTime[];
  time: Option<string>;
  minutes: number;
  tooltips: boolean;
  onSelectDay: (day: DateTime) => void;
  onMonthChange: (month: DateTime) => void;
  onTimeChange: (time: string) => void;
  onMinutesChange: (minutes: number) => void;
}

export interface AppliesToModel {
  scope: MoveScope;
  /** The series' rule once it has loaded, or why only this session can change. */
  subline: Option<string>;
  /** False when the series couldn't load. */
  followingAvailable: boolean;
  onScopeChange: (scope: MoveScope) => void;
}

export interface RepeatModel {
  repeat: RepeatChoice;
  /** Offers "Doesn't repeat". */
  optional: boolean;
  /** The series' rule is still loading, so nothing can be changed against the defaults. */
  locked: boolean;
  byWeekdays: Weekday[];
  lockedWeekday: Weekday;
  /** What each end option starts at when chosen. */
  defaultEnd: { count: number; until: string };
  /** The series' own rhythm when no standard choice matches it. */
  seriesCadence: Option<Cadence>;
  error: Option<string>;
  onRepeatChange: (cadence: Option<Cadence>) => void;
  onWeekdaysChange: (days: Weekday[]) => void;
  onEndChange: (end: RecurrenceEnd) => void;
}

export interface ResolveModel {
  subline: string;
  movable: boolean;
  /** The new time overlaps more than one session. */
  several: boolean;
  newStart: DateTime;
  days: { day: DateTime; past: boolean }[];
  selectedDay: DateTime;
  slots: DateTime[];
  resolution: Resolution;
  onSelectDay: (day: DateTime) => void;
  onMove: (start: DateTime) => void;
  onKeep: () => void;
}

export interface SummaryModel {
  userId: Id;
  initials: string;
  firstName: string;
  count: number;
  provider: Option<Provider>;
}

/** Who and when the session being moved is. */
export interface MoverModel {
  userId: Id;
  initials: string;
  fullName: string;
  currently: string;
}

export interface NewSessionDialogModel {
  title: string;
  mover: Option<MoverModel>;
  step: StepKind;
  rail: StepRailItem[];
  position: { index: number; total: number };
  onPrev: Option<() => void>;
  onNext: Option<() => void>;
  lead: StepDialogLead;
  summary: Option<SummaryModel>;
  who: WhoModel;
  when: WhenModel;
  appliesTo: AppliesToModel;
  repeat: RepeatModel;
  resolve: Option<ResolveModel>;
}

/** How an overlap is being settled; a different clash, start or length starts over. */
export interface ResolveDraft {
  clashId: Id;
  newStartMs: number;
  minutes: number;
  day: DateTime;
  resolution: Resolution;
}

export function startAt(day: Option<DateTime>, time: Option<string>): Option<DateTime> {
  if (day.none || time.none) return None;
  const [hour, minute] = time.val.split(":").map(Number);
  return Some(day.val.set({ hour, minute, second: 0, millisecond: 0 }));
}

export function whoState(data: ScheduleData): WhoState {
  switch (data.people.kind) {
    case "loading":
    case "error":
      return data.people;
    case "loaded":
      return data.people.entries.length === 0 ? { kind: "empty" } : { kind: "ready", people: data.people.picker };
    default: {
      const _exhaustive: never = data.people;
      throw new Error(`Unhandled people state: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function peopleEntries(data: ScheduleData): PersonEntry[] {
  return data.people.kind === "loaded" ? data.people.entries : [];
}

export function entryFor(data: ScheduleData, personId: Option<Id>): Option<PersonEntry> {
  if (personId.none) return None;
  const entry = peopleEntries(data).find((e) => e.person.userId === personId.val);
  return entry ? Some(entry) : None;
}

export function usualOf(data: ScheduleData, entry: Option<PersonEntry>): Option<UsualSlot> {
  return entry.some ? usualFor(entry.val.relationshipIds, data.known, data.now, data.timezone) : None;
}

export function repeatChoice(repeating: boolean, cadence: Cadence, end: RecurrenceEnd): RepeatChoice {
  return repeating ? { kind: "repeat", ...cadence, end } : { kind: "none" };
}

/** The Repeat step's standard choices. */
export const STANDARD_CADENCES: readonly Cadence[] = [
  { frequency: Frequency.Weekly, interval: 1 },
  { frequency: Frequency.Biweekly, interval: 1 },
  { frequency: Frequency.Monthly, interval: 1 },
];

export function sameCadence(a: Cadence, b: Cadence): boolean {
  return a.frequency === b.frequency && a.interval === b.interval;
}

/** A series' rhythm the standard choices can't show, offered as a choice of its own. */
export function seriesCadenceOf(repeat: Option<Cadence>): Option<Cadence> {
  if (repeat.none) return None;
  const { frequency, interval } = repeat.val;
  return STANDARD_CADENCES.some((c) => sameCadence(c, repeat.val)) ? None : Some({ frequency, interval });
}

export function createsCount(repeat: RepeatChoice, start: Option<DateTime>, byWeekdays: Weekday[]): number {
  if (repeat.kind === "none") return 1;
  if (repeat.end.kind === "count") return repeat.end.count;
  return start.some
    ? occurrenceCount({ start: start.val, frequency: repeat.frequency, byWeekdays, end: repeat.end })
    : 1;
}

export function summaryOf(entry: PersonEntry, count: number, provider: Option<Provider>): SummaryModel {
  const { userId, initials, firstName } = entry.person;
  return { userId, initials, firstName, count, provider };
}

export interface LeadInput {
  last: boolean;
  hint: Option<string>;
  label: string;
  error: Option<string>;
  submitting: boolean;
  onConfirm: () => void;
}

export function leadFor({ last, hint, label, error, submitting, onConfirm }: LeadInput): StepDialogLead {
  if (!last) return { kind: "none" };
  if (hint.some) return { kind: "hint", text: hint.val };
  return { kind: "confirm", label, disabled: error.some, pending: submitting, onConfirm };
}

interface ResolveInput {
  clash: BusyClash;
  start: DateTime;
  minutes: number;
  /** The other session, when the user coaches its relationship. */
  movable: boolean;
  draft: ResolveDraft;
  busy: BusySession[];
  now: DateTime;
  onChange: (draft: ResolveDraft) => void;
}

export function resolveModel(input: ResolveInput): ResolveModel {
  const { clash, start, minutes, movable, draft, busy, now, onChange } = input;
  const several = clash.others.length > 0;
  return {
    subline: several
      ? overlapsNewLines([clash.session, ...clash.others])
      : movable
        ? resolveSubline(clash.session)
        : overlapsNewLine(clash.session),
    movable,
    several,
    newStart: start,
    days: resolveDays(clash.session.start, now),
    selectedDay: draft.day,
    slots: movable
      ? resolveSlots({
          day: draft.day,
          clash: clash.session,
          newSlot: { start, minutes },
          busy,
          hours: DEFAULT_WORKING_HOURS,
          now,
        })
      : [],
    resolution: draft.resolution,
    onSelectDay: (day) => onChange({ ...draft, day }),
    onMove: (moveTo) => onChange({ ...draft, resolution: { kind: "move", start: moveTo } }),
    onKeep: () => onChange({ ...draft, resolution: { kind: "keep" } }),
  };
}

export function draftFor(
  clash: Option<BusyClash>,
  newSlot: { start: DateTime; minutes: number },
  saved: Option<ResolveDraft>
): Option<ResolveDraft> {
  if (clash.none) return None;
  const { session } = clash.val;
  const key = { clashId: session.id, newStartMs: newSlot.start.toMillis(), minutes: newSlot.minutes };
  const same =
    saved.some &&
    saved.val.clashId === key.clashId &&
    saved.val.newStartMs === key.newStartMs &&
    saved.val.minutes === key.minutes;
  if (same) return saved;
  return Some({ ...key, day: session.start.startOf("day"), resolution: UNRESOLVED });
}

/** The draft a request opens on; a move starts at the session itself, as if already picked. */
export interface InitialDraft {
  day: Option<DateTime>;
  month: Option<DateTime>;
  time: Option<string>;
  minutes: Option<number>;
  whenTouched: boolean;
  step: StepKind;
}

export function initialDraft(request: NewSessionRequest, timezone: string): InitialDraft {
  switch (request.kind) {
    case "schedule":
      return {
        day: request.date.some ? Some(request.date.val.startOf("day")) : None,
        month: None,
        time: None,
        minutes: None,
        whenTouched: false,
        step: StepKind.Who,
      };
    case "move": {
      const { day, time } = moveStart(request.session, timezone);
      return {
        day: Some(day),
        month: Some(day.startOf("month")),
        time: Some(time),
        minutes: Some(request.session.duration_minutes),
        whenTouched: true,
        step: StepKind.When,
      };
    }
    default: {
      const _exhaustive: never = request;
      throw new Error(`Unhandled new session request: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function moverOf(entry: PersonEntry, session: EnrichedCoachingSession, timezone: string): MoverModel {
  const { userId, initials, fullName } = entry.person;
  return { userId, initials, fullName, currently: currentlyLine(sessionStartIn(session.date, timezone)) };
}
