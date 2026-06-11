import { useCallback, useEffect, useState } from "react";
import { DateTime } from "ts-luxon";
import {
  Frequency,
  RecurrenceEnd,
  Weekday,
  frequencySupportsWeekdays,
  weekdayFromLuxon,
} from "@/types/recurrence";

export interface RecurrenceStateInit {
  frequency?: Frequency;
  interval?: number;
  byWeekdays?: Weekday[];
  end?: RecurrenceEnd;
}

export interface UseRecurrenceStateArgs {
  enabled: boolean;
  startWeekday: Weekday | null;
  timezone: string;
  init?: RecurrenceStateInit;
}

const DEFAULT_END: RecurrenceEnd = { kind: "count", count: 4 };

/**
 * Owns the recurrence-rule form state (frequency / interval / weekdays / end)
 * shared by the create-session form and the series reschedule dialog, plus the
 * auto-seed effect that keeps the first session's weekday selected.
 */
export function useRecurrenceState({
  enabled,
  startWeekday,
  timezone,
  init,
}: UseRecurrenceStateArgs) {
  const [frequency, setFrequency] = useState<Frequency>(
    init?.frequency ?? Frequency.Weekly
  );
  const [interval, setInterval] = useState<number>(init?.interval ?? 1);
  const [byWeekdays, setByWeekdays] = useState<Weekday[]>(
    init?.byWeekdays ?? []
  );
  const [end, setEnd] = useState<RecurrenceEnd>(init?.end ?? DEFAULT_END);

  useEffect(() => {
    if (!enabled) return;
    if (!frequencySupportsWeekdays(frequency)) return;
    if (byWeekdays.length !== 0) return;
    const seed =
      startWeekday ??
      weekdayFromLuxon(DateTime.now().setZone(timezone).weekday);
    // Seed-once-but-overridable: a pure derivation can't express "default to
    // the start weekday yet let the user deselect it", so this stays an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setByWeekdays([seed]);
  }, [enabled, frequency, startWeekday, byWeekdays.length, timezone]);

  const reset = useCallback(() => {
    setFrequency(init?.frequency ?? Frequency.Weekly);
    setInterval(init?.interval ?? 1);
    setByWeekdays(init?.byWeekdays ?? []);
    setEnd(init?.end ?? DEFAULT_END);
  }, [init]);

  return {
    frequency,
    setFrequency,
    interval,
    setInterval,
    byWeekdays,
    setByWeekdays,
    end,
    setEnd,
    reset,
  };
}
