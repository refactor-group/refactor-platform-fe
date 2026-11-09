import { DateTime } from "ts-luxon";
import type { WorkingHours } from "@/lib/scheduling";
import { type Option, None, Some } from "@/types/option";
import {
  type User,
  WORKING_HOURS_END_FALLBACK,
  WORKING_HOURS_START_FALLBACK,
} from "@/types/user";

const STEP_MINUTES = 30;
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseClock(text: string): Option<number> {
  const match = CLOCK.exec(text);
  if (!match) return None;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes % STEP_MINUTES === 0 ? Some(minutes) : None;
}

function fallbackMinutes(clock: string): number {
  const minutes = parseClock(clock);
  if (minutes.none) throw new Error(`Invalid fallback clock: ${clock}`);
  return minutes.val;
}

export const WORKING_HOURS_FALLBACK: WorkingHours = {
  start: fallbackMinutes(WORKING_HOURS_START_FALLBACK),
  end: fallbackMinutes(WORKING_HOURS_END_FALLBACK),
};

function atMinutes(minutes: number): DateTime {
  return DateTime.fromObject({ hour: Math.floor(minutes / 60), minute: minutes % 60 });
}

export function formatClock(minutes: number): string {
  return atMinutes(minutes).toFormat("HH:mm");
}

export function clockLabel(minutes: number): string {
  return atMinutes(minutes).toFormat("h:mm a");
}

export function halfHourClocks(): number[] {
  return Array.from({ length: (24 * 60) / STEP_MINUTES }, (_, i) => i * STEP_MINUTES);
}

export function workingHoursOf(user: Option<User>): WorkingHours {
  if (user.none) return WORKING_HOURS_FALLBACK;
  const start = parseClock(user.val.working_hours_start);
  const end = parseClock(user.val.working_hours_end);
  if (start.none || end.none || start.val >= end.val) return WORKING_HOURS_FALLBACK;
  return { start: start.val, end: end.val };
}
