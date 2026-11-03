"use client";

import { useState } from "react";
import type { DateTime } from "ts-luxon";
import type { PickerPerson } from "@/components/ui/new-session/person-picker";
import type { StepDialogLead, StepRailItem } from "@/components/ui/step-dialog";
import { MODAL_DESKTOP_QUERY } from "@/lib/breakpoints";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { type RecurrenceStateInit, useRecurrenceState } from "@/lib/hooks/use-recurrence-state";
import { type ScheduleData, useScheduleData } from "@/lib/hooks/use-schedule-data";
import { useScheduleSubmit } from "@/lib/hooks/use-schedule-submit";
import type { PersonEntry } from "@/lib/people";
import {
  type Resolution,
  clashFor,
  occurrenceCount,
  prefillWhen,
  resolveDays,
  resolveSlots,
  scheduleHint,
  scheduleRail,
  swapStartWeekday,
  usualFor,
} from "@/lib/schedule-draft";
import {
  type BusyClash,
  type BusySession,
  DEFAULT_WORKING_HOURS,
  type UsualSlot,
  type RepeatChoice,
  StepKind,
  busyOn,
  currentStep,
  nextStep,
  prevStep,
  stepOrder,
  stepPosition,
  suggestTimes,
} from "@/lib/scheduling";
import { overlapsNewLine, resolveSubline, scheduleSubmitLabel } from "@/lib/scheduling-copy";
import type { NewSessionRequest } from "@/lib/stores/new-session-dialog-store";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import type { Provider } from "@/types/provider";
import {
  Frequency,
  type RecurrenceEnd,
  type Weekday,
  validateRecurrence,
  weekdayFromLuxon,
} from "@/types/recurrence";

const DEFAULT_COUNT = 8;
const DEFAULT_UNTIL_WEEKS = 8;
const RECURRENCE_INIT: RecurrenceStateInit = { end: { kind: "count", count: DEFAULT_COUNT } };
const UNRESOLVED: Resolution = { kind: "unresolved" };

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

export interface RepeatModel {
  repeat: RepeatChoice;
  byWeekdays: Weekday[];
  lockedWeekday: Weekday;
  /** What each end option starts at when chosen. */
  defaultEnd: { count: number; until: string };
  error: Option<string>;
  onRepeatChange: (frequency: Option<Frequency>) => void;
  onWeekdaysChange: (days: Weekday[]) => void;
  onEndChange: (end: RecurrenceEnd) => void;
}

export interface ResolveModel {
  subline: string;
  movable: boolean;
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

export interface NewSessionDialogModel {
  step: StepKind;
  rail: StepRailItem[];
  position: { index: number; total: number };
  onPrev: Option<() => void>;
  onNext: Option<() => void>;
  lead: StepDialogLead;
  summary: Option<SummaryModel>;
  who: WhoModel;
  when: WhenModel;
  repeat: RepeatModel;
  resolve: Option<ResolveModel>;
}

/** How an overlap is being settled; tied to one clash so a different one starts over. */
interface ResolveDraft {
  clashId: Id;
  day: DateTime;
  resolution: Resolution;
}

function startAt(day: Option<DateTime>, time: Option<string>): Option<DateTime> {
  if (day.none || time.none) return None;
  const [hour, minute] = time.val.split(":").map(Number);
  return Some(day.val.set({ hour, minute, second: 0, millisecond: 0 }));
}

function whoState(data: ScheduleData): WhoState {
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

function entryFor(data: ScheduleData, personId: Option<Id>): Option<PersonEntry> {
  if (personId.none || data.people.kind !== "loaded") return None;
  const entry = data.people.entries.find((e) => e.person.userId === personId.val);
  return entry ? Some(entry) : None;
}

function usualOf(data: ScheduleData, entry: Option<PersonEntry>): Option<UsualSlot> {
  return entry.some ? usualFor(entry.val.relationshipIds, data.known, data.now, data.timezone) : None;
}

function repeatChoice(repeating: boolean, frequency: Frequency, end: RecurrenceEnd): RepeatChoice {
  return repeating ? { kind: "repeat", frequency, end } : { kind: "none" };
}

function createsCount(repeat: RepeatChoice, start: Option<DateTime>, byWeekdays: Weekday[]): number {
  if (repeat.kind === "none") return 1;
  if (repeat.end.kind === "count") return repeat.end.count;
  return start.some
    ? occurrenceCount({ start: start.val, frequency: repeat.frequency, byWeekdays, end: repeat.end })
    : 1;
}

function summaryOf(entry: PersonEntry, count: number, provider: Option<Provider>): SummaryModel {
  const { userId, initials, firstName } = entry.person;
  return { userId, initials, firstName, count, provider };
}

interface LeadInput {
  last: boolean;
  hint: Option<string>;
  repeat: RepeatChoice;
  error: Option<string>;
  submitting: boolean;
  onConfirm: () => void;
}

function leadFor({ last, hint, repeat, error, submitting, onConfirm }: LeadInput): StepDialogLead {
  if (!last) return { kind: "none" };
  if (hint.some) return { kind: "hint", text: hint.val };
  return { kind: "confirm", label: scheduleSubmitLabel(repeat), disabled: error.some, pending: submitting, onConfirm };
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

function resolveModel(input: ResolveInput): ResolveModel {
  const { clash, start, minutes, movable, draft, busy, now, onChange } = input;
  return {
    subline: movable ? resolveSubline(clash.session) : overlapsNewLine(clash.session),
    movable,
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

function draftFor(clash: Option<BusyClash>, saved: Option<ResolveDraft>): Option<ResolveDraft> {
  if (clash.none) return None;
  const { session } = clash.val;
  if (saved.some && saved.val.clashId === session.id) return saved;
  return Some({ clashId: session.id, day: session.start.startOf("day"), resolution: UNRESOLVED });
}

function untilAfter(start: DateTime): string {
  return start.plus({ weeks: DEFAULT_UNTIL_WEEKS }).toFormat("yyyy-MM-dd");
}

export function useNewSessionDialog(request: NewSessionRequest, onClose: () => void): NewSessionDialogModel {
  const desktop = useMediaQuery(MODAL_DESKTOP_QUERY);
  const [personId, setPersonId] = useState<Option<Id>>(None);
  // Before a person is picked, only a requested date is prefilled.
  const [day, setDay] = useState<Option<DateTime>>(() =>
    request.date.some ? Some(request.date.val.startOf("day")) : None
  );
  const [month, setMonth] = useState<Option<DateTime>>(None);
  const [time, setTime] = useState<Option<string>>(None);
  const [whenTouched, setWhenTouched] = useState(false);
  const [chosenMinutes, setChosenMinutes] = useState<Option<number>>(None);
  const [step, setStep] = useState<StepKind>(StepKind.Who);
  const [repeating, setRepeating] = useState(false);
  const [savedResolve, setSavedResolve] = useState<Option<ResolveDraft>>(None);

  const data = useScheduleData({ month, selected: day });
  const { now, timezone, busy } = data;
  const { submitting, submit } = useScheduleSubmit(onClose);
  const minutes = chosenMinutes.some ? chosenMinutes.val : data.defaultMinutes;
  const start = startAt(day, time);
  const startWeekday = day.some ? weekdayFromLuxon(day.val.weekday) : null;
  const recurrence = useRecurrenceState({ enabled: repeating, startWeekday, timezone, init: RECURRENCE_INIT });
  // Keep the chosen days following the start date's weekday, adjusted during render.
  const [seenWeekday, setSeenWeekday] = useState(startWeekday);
  if (startWeekday !== seenWeekday) {
    setSeenWeekday(startWeekday);
    if (seenWeekday && startWeekday) {
      recurrence.setByWeekdays(swapStartWeekday(recurrence.byWeekdays, seenWeekday, startWeekday));
    }
  }
  const repeat = repeatChoice(repeating, recurrence.frequency, recurrence.end);
  const recurrenceError = repeating
    ? validateRecurrence({
        frequency: recurrence.frequency,
        interval: 1,
        byWeekdays: recurrence.byWeekdays,
        end: recurrence.end,
        start: start.some ? start.val : null,
        startWeekday,
        timezone,
      })
    : null;
  const error: Option<string> = recurrenceError ? Some(recurrenceError) : None;

  const entry = entryFor(data, personId);
  const personName = entry.some ? Some(entry.val.person.fullName) : None;
  // Only the first session of a series is checked.
  const clash = start.some ? clashFor({ start: start.val, minutes }, busy, DEFAULT_WORKING_HOURS) : None;
  const clashSession = clash.some ? Some(clash.val.session) : None;
  const resolveDraft = draftFor(clash, savedResolve);
  const resolution = resolveDraft.some ? resolveDraft.val.resolution : UNRESOLVED;
  const other = clash.some ? data.busySource.find((s) => s.id === clash.val.session.id) : undefined;
  const movable = other !== undefined && other.relationship?.coach_id === data.userId;

  const order = stepOrder({ kind: "schedule" }, clash.some);
  const current = currentStep(order, step);
  const next = nextStep(order, current);
  const prev = prevStep(order, current);

  const confirm = () => {
    if (entry.none || start.none) return;
    submit({
      relationshipId: entry.val.relationshipIds[0],
      personName: entry.val.person.fullName,
      start: start.val,
      minutes,
      provider: data.provider,
      repeat,
      byWeekdays: recurrence.byWeekdays,
      timezone,
      move:
        clash.some && other && resolution.kind === "move"
          ? Some({ session: other, personName: clash.val.session.personName, start: resolution.start })
          : None,
    });
  };

  const selectPerson = (userId: Id) => {
    setPersonId(Some(userId));
    if (whenTouched) return;
    const usual = usualOf(data, entryFor(data, Some(userId)));
    const when = prefillWhen({ requested: request.date, usual, busy, minutes, now });
    setDay(when.day);
    setTime(when.time);
    if (when.day.some) setMonth(Some(when.day.val.startOf("month")));
  };

  return {
    step: current,
    rail: scheduleRail({ order, step, personName, start, repeat, clash: clashSession, resolution }),
    position: stepPosition(order, step),
    onPrev: prev.some ? Some(() => setStep(prev.val)) : None,
    onNext: next.some ? Some(() => setStep(next.val)) : None,
    lead: leadFor({
      last: next.none,
      hint: scheduleHint({ personName, start, clash: clashSession, resolution }),
      repeat,
      error,
      submitting,
      onConfirm: confirm,
    }),
    summary: entry.some
      ? Some(summaryOf(entry.val, createsCount(repeat, start, recurrence.byWeekdays), data.provider))
      : None,
    who: { state: whoState(data), selectedId: personId, onSelect: selectPerson },
    when: {
      month: data.month,
      today: now,
      day,
      busy,
      dayBusy: day.some ? busyOn(busy, day.val, None) : [],
      clash,
      suggestions: day.some
        ? suggestTimes({
            day: day.val,
            minutes,
            usual: usualOf(data, entry),
            coachStarts: data.coachStarts,
            busy,
            hours: DEFAULT_WORKING_HOURS,
            now,
          })
        : [],
      time,
      minutes,
      tooltips: desktop,
      onSelectDay: (picked) => {
        setWhenTouched(true);
        setDay(Some(picked));
      },
      onMonthChange: (shown) => setMonth(Some(shown)),
      onTimeChange: (value) => {
        setWhenTouched(true);
        setTime(Some(value));
      },
      onMinutesChange: (value) => setChosenMinutes(Some(value)),
    },
    repeat: {
      repeat,
      byWeekdays: recurrence.byWeekdays,
      lockedWeekday: startWeekday ?? weekdayFromLuxon(now.weekday),
      defaultEnd: { count: DEFAULT_COUNT, until: untilAfter(start.some ? start.val : now) },
      error,
      onRepeatChange: (frequency) => {
        setRepeating(frequency.some);
        if (frequency.some) recurrence.setFrequency(frequency.val);
      },
      onWeekdaysChange: recurrence.setByWeekdays,
      onEndChange: recurrence.setEnd,
    },
    resolve:
      clash.some && start.some && resolveDraft.some
        ? Some(
            resolveModel({
              clash: clash.val,
              start: start.val,
              minutes,
              movable,
              draft: resolveDraft.val,
              busy,
              now,
              onChange: (draft) => setSavedResolve(Some(draft)),
            })
          )
        : None,
  };
}
