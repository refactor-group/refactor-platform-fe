import { useMemo } from "react";
import { DateTime } from "ts-luxon";
import { weekOf, type Week } from "@/lib/week-grid/week";

/** The week `offset` weeks from the current one, keyed on the local date so the fetch key holds steady across clock ticks. */
export function useWeekAt(offset: number, now: DateTime, timezone: string): Week {
  const today = now.setZone(timezone).startOf("day").toMillis();
  return useMemo(
    () => weekOf(offset, DateTime.fromMillis(today, { zone: timezone }), timezone),
    [offset, today, timezone]
  );
}
