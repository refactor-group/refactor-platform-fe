import { DateTime, Info } from "ts-luxon";
import type { BusySession, RepeatChoice, UsualSlot } from "@/lib/scheduling";
import { shortDate, timeOfDay } from "@/lib/session-window";
import { formatWeekdayDate } from "@/lib/utils/date";
import { type Option, None, Some } from "@/types/option";
import { Provider } from "@/types/provider";
import { Frequency, type RecurrenceEnd } from "@/types/recurrence";

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

function firstSessionLine(next: DateTime, now: DateTime): string {
  const days = daysAhead(next, now);
  const when = days >= 0 && days <= FIRST_SESSION_WEEKDAY_DAYS ? next.toFormat("cccc") : shortDate(next);
  return `First session ${when}`;
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

function frequencyPhrase(frequency: Frequency): string {
  switch (frequency) {
    case Frequency.Daily:
      return "Daily";
    case Frequency.Weekly:
      return "Weekly";
    case Frequency.Biweekly:
      return "Every 2 weeks";
    case Frequency.Monthly:
      return "Monthly";
    default: {
      const _exhaustive: never = frequency;
      throw new Error(`Unhandled frequency: ${_exhaustive}`);
    }
  }
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
      return `${frequencyPhrase(choice.frequency)}, ${endPhrase(choice.end)}`;
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

export function moveSubmitLabel(following: boolean): string {
  return following ? "Reschedule this and following" : "Reschedule session";
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

export function resolveSubline(clash: BusySession): string {
  return `${overlapsNewLine(clash)} Move it to:`;
}
