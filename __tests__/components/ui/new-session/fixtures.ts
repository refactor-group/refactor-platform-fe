import { DateTime } from "ts-luxon";
import type { BusySession } from "@/lib/scheduling";

export const ZONE = "America/Chicago";
export const at = (iso: string) => DateTime.fromISO(iso, { zone: ZONE });

/** Monday, August 17, 2026. */
export const TODAY = at("2026-08-17T10:00");

export const EHAB: BusySession = {
  id: "s-ehab",
  personName: "Ehab Badawi",
  start: at("2026-08-18T14:30"),
  end: at("2026-08-18T15:20"),
};

export const PRIYA: BusySession = {
  id: "s-priya",
  personName: "Priya Raman",
  start: at("2026-08-18T16:30"),
  end: at("2026-08-18T17:20"),
};
