import { DateTime } from "ts-luxon";
import type { BusySession } from "@/lib/scheduling";

export const ZONE = "America/Chicago";

export const at = (iso: string) => DateTime.fromISO(iso, { zone: ZONE });

export const busy = (id: string, personName: string, start: string, end: string): BusySession => ({
  id,
  personName,
  start: at(start),
  end: at(end),
});

/** Monday, the day before the fixtures' Tuesday. */
export const NOW = at("2026-08-17T10:00");
export const TUESDAY = at("2026-08-18T00:00");

export const EHAB = busy("s-ehab", "Ehab Badawi", "2026-08-18T14:30", "2026-08-18T15:20");
export const PRIYA = busy("s-priya", "Priya Raman", "2026-08-18T16:30", "2026-08-18T17:20");
export const ALEX_WED = busy("s-alex", "Alex Chen", "2026-08-19T09:00", "2026-08-19T09:50");

export const hhmm = (times: DateTime[]) => times.map((t) => t.toFormat("HH:mm"));
