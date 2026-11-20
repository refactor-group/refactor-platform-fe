import type { DateTime } from "ts-luxon";
import { SessionUrgency } from "@/types/session-display";
import type { Option } from "@/types/option";

/** Calendar days from `now` to `start`, not 24-hour spans. */
function calendarDaysAhead(start: DateTime, now: DateTime): number {
  return Math.round(start.startOf("day").diff(now.startOf("day"), "days").days);
}

function dayLabel(start: DateTime, now: DateTime): string {
  const days = calendarDaysAhead(start, now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return start.toFormat("cccc");
}

/** "Today with Justin at 3:05 PM". `start` and `now` must be in the user's zone. No first name drops "with". */
export function nextSessionHeadline(firstName: Option<string>, start: DateTime, now: DateTime): string {
  const day = dayLabel(start, now);
  const time = start.toFormat("h:mm a");
  return firstName.some ? `${day} with ${firstName.val} at ${time}` : `${day} at ${time}`;
}

export interface NextSessionWhen {
  text: string;
  /** Brand color and pulsing dot. */
  hot: boolean;
}

function minutesText(m: number): string {
  return m === 1 ? "1 min" : `${m} mins`;
}

function startsIn(m: number): string {
  if (m < 60) return `Starts in ${minutesText(m)}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `Starts in ${h} h` : `Starts in ${h} h ${minutesText(r)}`;
}

/** The short line under the headline. `start` and `now` must be in the user's zone. */
export function nextSessionWhen(start: DateTime, now: DateTime, urgency: SessionUrgency): NextSessionWhen {
  if (now >= start) return { text: "Currently under way", hot: true };
  if (calendarDaysAhead(start, now) !== 0) return { text: start.toFormat("ccc, LLL d"), hot: false };
  const m = Math.ceil(start.diff(now, "minutes").minutes);
  return { text: startsIn(m), hot: urgency === SessionUrgency.Imminent };
}
