import { DateTime, Info } from "ts-luxon";
import { type BusySession, type Cadence, MoveScope, type RepeatChoice, type UsualSlot } from "@/lib/scheduling";
import { shortDate, timeOfDay } from "@/lib/session-window";
import { formatWeekdayDate } from "@/lib/utils/date";
import { type Option, None, Some } from "@/types/option";
import { Provider } from "@/types/provider";
import type { SeriesRecurrence } from "@/types/coaching-session-series";
import { Frequency, type RecurrenceEnd, WEEKDAYS_ORDERED, type Weekday, frequencySupportsWeekdays } from "@/types/recurrence";

const FIRST_SESSION_WEEKDAY_DAYS = 6;

export function sessionCount(count: number): string {
  return `${count} session${count === 1 ? "" : "s"}`;
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0];
}

/** "Tue 18". */
export function shortDay(dt: DateTime): string {
  return dt.toFormat("ccc d");
}

/** A minute of the day as "2:30 PM"; UTC so no DST gap can shift it. */
function clockAt(minute: number): string {
  return timeOfDay(DateTime.fromObject({ hour: Math.floor(minute / 60), minute: minute % 60 }, { zone: "utc" }));
}

export function usualSlotLabel(slot: UsualSlot): string {
  return `Usually ${Info.weekdays("long")[slot.weekday - 1]}s, ${clockAt(slot.minute)}`;
}

export interface WhoSublineInput {
  usual: Option<UsualSlot>;
  next: Option<DateTime>;
  last: Option<DateTime>;
}

function daysAhead(day: DateTime, now: DateTime): number {
  return Math.round(day.startOf("day").diff(now.setZone(day.zone).startOf("day"), "days").days);
}

function firstSessionDay(next: DateTime, now: DateTime): string {
  const days = daysAhead(next, now);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return days > 1 && days <= FIRST_SESSION_WEEKDAY_DAYS ? next.toFormat("cccc") : shortDate(next);
}

function firstSessionLine(next: DateTime, now: DateTime): string {
  return `First session ${firstSessionDay(next, now)}`;
}

export function whoSubline(input: WhoSublineInput, now: DateTime): string {
  const { usual, next, last } = input;
  if (usual.some) return usualSlotLabel(usual.val);
  if (last.none && next.some) return firstSessionLine(next.val, now);
  if (last.some) return `Last session ${shortDate(last.val)}`;
  return "No sessions yet";
}

export function busyHeader(day: DateTime): string {
  return `Already on ${formatWeekdayDate(day)}`;
}

export function nothingElseLine(day: DateTime): string {
  return `Nothing else on ${formatWeekdayDate(day)}.`;
}

export function busyRange(session: BusySession): string {
  return `${timeOfDay(session.start)}–${timeOfDay(session.end)}`;
}

function sameMeridiem(a: DateTime, b: DateTime): boolean {
  return a.hour < 12 === b.hour < 12;
}

/** "2:30–3:20 PM", keeping both meridiems when they differ. */
function compactRange(start: DateTime, end: DateTime): string {
  const from = sameMeridiem(start, end) ? start.toFormat("h:mm") : timeOfDay(start);
  return `${from}–${timeOfDay(end)}`;
}

export function overlapLine(clash: BusySession): string {
  return `Overlaps with ${firstNameOf(clash.personName)}, ${compactRange(clash.start, clash.end)}`;
}

export function insteadLabel(start: DateTime): string {
  return `Use ${timeOfDay(start)} instead`;
}

/** "Weekly", "Every 2 weeks", "Every 3 months". */
export function cadenceLabel(cadence: Cadence): string {
  const phrase = rhythmPhrase(cadence);
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

function endPhrase(end: RecurrenceEnd): string {
  switch (end.kind) {
    case "count":
      return `for ${sessionCount(end.count)}`;
    case "until":
      return `until ${shortDate(DateTime.fromISO(end.until))}`;
    default: {
      const _exhaustive: never = end;
      throw new Error(`Unhandled recurrence end: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function repeatLabel(choice: RepeatChoice): string {
  switch (choice.kind) {
    case "none":
      return "Doesn't repeat";
    case "repeat":
      return `${cadenceLabel(choice)}, ${endPhrase(choice.end)}`;
    default: {
      const _exhaustive: never = choice;
      throw new Error(`Unhandled repeat choice: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function scheduleSubmitLabel(choice: RepeatChoice): string {
  switch (choice.kind) {
    case "none":
      return "Schedule session";
    case "repeat":
      return choice.end.kind === "count" ? `Schedule ${sessionCount(choice.end.count)}` : "Schedule series";
    default: {
      const _exhaustive: never = choice;
      throw new Error(`Unhandled repeat choice: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function moveScopeTitle(scope: MoveScope): string {
  switch (scope) {
    case MoveScope.This:
      return "This session only";
    case MoveScope.Following:
      return "This and following sessions";
    default: {
      const _exhaustive: never = scope;
      throw new Error(`Unhandled move scope: ${_exhaustive}`);
    }
  }
}

function every(count: number, unit: string, single: string): string {
  return count === 1 ? single : `every ${count} ${unit}s`;
}

function rhythmPhrase({ frequency, interval }: Cadence): string {
  switch (frequency) {
    case Frequency.Daily:
      return every(interval, "day", "daily");
    case Frequency.Weekly:
      return every(interval, "week", "weekly");
    case Frequency.Biweekly:
      return every(interval * 2, "week", "weekly");
    case Frequency.Monthly:
      return every(interval, "month", "monthly");
    default: {
      const _exhaustive: never = frequency;
      throw new Error(`Unhandled frequency: ${_exhaustive}`);
    }
  }
}

/** "Mondays, Wednesdays and Fridays". */
function weekdaysPhrase(days: SeriesRecurrence["by_weekdays"]): string {
  const names = WEEKDAYS_ORDERED.flatMap((day, index) =>
    days?.includes(day) ? [`${Info.weekdays("long")[index]}s`] : []
  );
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("");
}

/** "Ehab's series repeats weekly on Tuesdays." */
export function seriesRuleLine(personName: string, recurrence: SeriesRecurrence): string {
  const days = frequencySupportsWeekdays(recurrence.frequency) ? weekdaysPhrase(recurrence.by_weekdays) : "";
  return `${firstNameOf(personName)}'s series repeats ${rhythmPhrase(recurrence)}${days ? ` on ${days}` : ""}.`;
}

export function moveTitle(following: boolean): string {
  return following ? "Reschedule series" : "Reschedule session";
}

export function moveSubmitLabel(following: boolean): string {
  return following ? "Reschedule this and following" : "Reschedule session";
}

/** "Move this and following sessions to Tuesdays, 2:00 PM". */
export function followingMoveLine(cadence: Cadence, byWeekdays: Weekday[], start: DateTime): string {
  const time = timeOfDay(start);
  const days = frequencySupportsWeekdays(cadence.frequency) ? weekdaysPhrase(byWeekdays) : "";
  return `Move this and following sessions to ${days ? `${days}, ${time}` : `${time}, ${rhythmPhrase(cadence)}`}`;
}

export function createsLine(count: number, firstName: string): string {
  return `${sessionCount(count)} with ${firstName}`;
}

function providerName(provider: Provider): string {
  switch (provider) {
    case Provider.Google:
      return "Google Meet";
    case Provider.Zoom:
      return "Zoom";
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unhandled provider: ${_exhaustive}`);
    }
  }
}

export function meetingLine(provider: Option<Provider>): Option<string> {
  return provider.some ? Some(`${providerName(provider.val)} link included`) : None;
}

export function currentlyLine(start: DateTime): string {
  return `Currently ${start.toFormat("ccc")}, ${shortDate(start)}, ${timeOfDay(start)}`;
}

/** For a session the user can't move: "Ehab's session on Tue 18 at 2:30 PM overlaps the new one." */
export function overlapsNewLine(clash: BusySession): string {
  return `${firstNameOf(clash.personName)}'s session on ${shortDay(clash.start)} at ${timeOfDay(clash.start)} overlaps the new one.`;
}

/** For several sessions: "Ehab's and Priya's sessions overlap the new one." */
export function overlapsNewLines(clashes: BusySession[]): string {
  const owners = clashes.map((c) => `${firstNameOf(c.personName)}'s`);
  const named = owners.length > 1 ? `${owners.slice(0, -1).join(", ")} and ${owners[owners.length - 1]}` : owners[0];
  return `${named} sessions overlap the new one.`;
}

export function resolveSubline(clash: BusySession): string {
  return `${overlapsNewLine(clash)} Move it to:`;
}
