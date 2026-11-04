"use client";

import { useState } from "react";
import { type RecurrenceStateInit, useRecurrenceState } from "@/lib/hooks/use-recurrence-state";
import type { SeriesRepeat } from "@/lib/move-draft";
import { swapStartWeekday } from "@/lib/schedule-draft";
import type { Cadence } from "@/lib/scheduling";
import { type Option, None, Some } from "@/types/option";
import type { Frequency, RecurrenceEnd, Weekday } from "@/types/recurrence";

export const DEFAULT_REPEAT_COUNT = 8;
const RECURRENCE_INIT: RecurrenceStateInit = { end: { kind: "count", count: DEFAULT_REPEAT_COUNT } };

/** A rule to start from once it's known, with the weekday its days were chosen around. */
export interface RepeatPrefill {
  repeat: SeriesRepeat;
  weekday: Weekday;
}

export interface DialogRecurrenceArgs {
  enabled: boolean;
  startWeekday: Weekday | null;
  timezone: string;
  prefill: Option<RepeatPrefill>;
}

export interface DialogRecurrence {
  frequency: Frequency;
  interval: number;
  byWeekdays: Weekday[];
  end: RecurrenceEnd;
  setCadence: (cadence: Cadence) => void;
  setByWeekdays: (days: Weekday[]) => void;
  setEnd: (end: RecurrenceEnd) => void;
}

/**
 * The Repeat step's rule. The chosen days follow the start date's weekday, and a prefill
 * that arrives after mount (a series still loading) applies once, unless the user got there first.
 */
export function useDialogRecurrence({ enabled, startWeekday, timezone, prefill }: DialogRecurrenceArgs): DialogRecurrence {
  const recurrence = useRecurrenceState({ enabled, startWeekday, timezone, init: RECURRENCE_INIT });
  const [touched, setTouched] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [seenWeekday, setSeenWeekday] = useState(startWeekday);

  // Adjusted during render, so the step never paints the stale rule.
  const arriving = !prefilled && prefill.some ? prefill : None;
  if (arriving.some) setPrefilled(true);
  const applying = arriving.some && !touched ? arriving : None;
  if (applying.some || startWeekday !== seenWeekday) {
    setSeenWeekday(startWeekday);
    const { days, from } = applying.some
      ? { days: applying.val.repeat.byWeekdays, from: Some(applying.val.weekday) }
      : { days: recurrence.byWeekdays, from: seenWeekday ? Some(seenWeekday) : None };
    if (applying.some) {
      recurrence.setFrequency(applying.val.repeat.frequency);
      recurrence.setInterval(applying.val.repeat.interval);
      recurrence.setEnd(applying.val.repeat.end);
    }
    recurrence.setByWeekdays(from.some && startWeekday ? swapStartWeekday(days, from.val, startWeekday) : days);
  }

  const touch =
    <T>(set: (value: T) => void) =>
    (value: T) => {
      setTouched(true);
      set(value);
    };

  return {
    frequency: recurrence.frequency,
    interval: recurrence.interval,
    byWeekdays: recurrence.byWeekdays,
    end: recurrence.end,
    setCadence: touch(({ frequency, interval }: Cadence) => {
      recurrence.setFrequency(frequency);
      recurrence.setInterval(interval);
    }),
    setByWeekdays: touch(recurrence.setByWeekdays),
    setEnd: touch(recurrence.setEnd),
  };
}
