import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import {
  Frequency,
  MAX_OCCURRENCES,
  MAX_SPAN_DAYS,
  Weekday,
  WEEKDAYS_ORDERED,
  frequencyLabel,
  frequencySupportsWeekdays,
  recurrenceToPayload,
  validateRecurrence,
  weekdayFromLuxon,
  weekdayLabel,
} from "@/types/recurrence";

describe("weekdayFromLuxon", () => {
  it("maps Luxon's 1..7 (Mon=1) to the Weekday enum in order", () => {
    expect(weekdayFromLuxon(1)).toBe(Weekday.Mon);
    expect(weekdayFromLuxon(2)).toBe(Weekday.Tue);
    expect(weekdayFromLuxon(3)).toBe(Weekday.Wed);
    expect(weekdayFromLuxon(4)).toBe(Weekday.Thu);
    expect(weekdayFromLuxon(5)).toBe(Weekday.Fri);
    expect(weekdayFromLuxon(6)).toBe(Weekday.Sat);
    expect(weekdayFromLuxon(7)).toBe(Weekday.Sun);
  });

  it("throws on out-of-range input", () => {
    expect(() => weekdayFromLuxon(0)).toThrow(/Invalid Luxon weekday/);
    expect(() => weekdayFromLuxon(8)).toThrow(/Invalid Luxon weekday/);
    expect(() => weekdayFromLuxon(-1)).toThrow(/Invalid Luxon weekday/);
  });
});

describe("weekdayLabel", () => {
  it("returns the three-letter label for every weekday", () => {
    expect(weekdayLabel(Weekday.Mon)).toBe("Mon");
    expect(weekdayLabel(Weekday.Tue)).toBe("Tue");
    expect(weekdayLabel(Weekday.Wed)).toBe("Wed");
    expect(weekdayLabel(Weekday.Thu)).toBe("Thu");
    expect(weekdayLabel(Weekday.Fri)).toBe("Fri");
    expect(weekdayLabel(Weekday.Sat)).toBe("Sat");
    expect(weekdayLabel(Weekday.Sun)).toBe("Sun");
  });
});

describe("frequencyLabel", () => {
  it("returns user-facing labels for every frequency", () => {
    expect(frequencyLabel(Frequency.Daily)).toBe("Daily");
    expect(frequencyLabel(Frequency.Weekly)).toBe("Weekly");
    expect(frequencyLabel(Frequency.Biweekly)).toBe("Bi-weekly");
    expect(frequencyLabel(Frequency.Monthly)).toBe("Monthly");
  });
});

describe("frequencySupportsWeekdays", () => {
  it("is true only for weekly and biweekly", () => {
    expect(frequencySupportsWeekdays(Frequency.Weekly)).toBe(true);
    expect(frequencySupportsWeekdays(Frequency.Biweekly)).toBe(true);
    expect(frequencySupportsWeekdays(Frequency.Daily)).toBe(false);
    expect(frequencySupportsWeekdays(Frequency.Monthly)).toBe(false);
  });
});

describe("WEEKDAYS_ORDERED", () => {
  it("is Mon through Sun in calendar order", () => {
    expect(WEEKDAYS_ORDERED).toEqual([
      Weekday.Mon,
      Weekday.Tue,
      Weekday.Wed,
      Weekday.Thu,
      Weekday.Fri,
      Weekday.Sat,
      Weekday.Sun,
    ]);
  });
});

describe("recurrenceToPayload", () => {
  it("omits interval when it equals 1 (backend default)", () => {
    const payload = recurrenceToPayload(Frequency.Weekly, 1, [Weekday.Mon], {
      kind: "count",
      count: 4,
    });
    expect(payload).not.toHaveProperty("interval");
  });

  it("includes interval when greater than 1", () => {
    const payload = recurrenceToPayload(Frequency.Weekly, 3, [Weekday.Mon], {
      kind: "count",
      count: 4,
    });
    expect(payload.interval).toBe(3);
  });

  it("omits by_weekdays for daily frequency", () => {
    const payload = recurrenceToPayload(
      Frequency.Daily,
      1,
      [Weekday.Mon, Weekday.Wed],
      { kind: "count", count: 4 }
    );
    expect(payload).not.toHaveProperty("by_weekdays");
  });

  it("omits by_weekdays for monthly frequency", () => {
    const payload = recurrenceToPayload(
      Frequency.Monthly,
      1,
      [Weekday.Mon, Weekday.Wed],
      { kind: "count", count: 4 }
    );
    expect(payload).not.toHaveProperty("by_weekdays");
  });

  it("includes by_weekdays for weekly frequency", () => {
    const payload = recurrenceToPayload(
      Frequency.Weekly,
      1,
      [Weekday.Mon, Weekday.Wed],
      { kind: "count", count: 4 }
    );
    expect(payload.by_weekdays).toEqual([Weekday.Mon, Weekday.Wed]);
  });

  it("includes by_weekdays for biweekly frequency", () => {
    const payload = recurrenceToPayload(
      Frequency.Biweekly,
      1,
      [Weekday.Tue],
      { kind: "count", count: 4 }
    );
    expect(payload.by_weekdays).toEqual([Weekday.Tue]);
  });

  it("reorders by_weekdays into canonical Mon→Sun order regardless of selection order", () => {
    const payload = recurrenceToPayload(
      Frequency.Weekly,
      1,
      [Weekday.Fri, Weekday.Mon, Weekday.Wed],
      { kind: "count", count: 4 }
    );
    expect(payload.by_weekdays).toEqual([
      Weekday.Mon,
      Weekday.Wed,
      Weekday.Fri,
    ]);
  });

  it("omits by_weekdays when the selection is empty (even on weekly)", () => {
    const payload = recurrenceToPayload(Frequency.Weekly, 1, [], {
      kind: "count",
      count: 4,
    });
    expect(payload).not.toHaveProperty("by_weekdays");
  });

  it("sets count and not until for an end-by-count", () => {
    const payload = recurrenceToPayload(Frequency.Weekly, 1, [Weekday.Mon], {
      kind: "count",
      count: 10,
    });
    expect(payload.count).toBe(10);
    expect(payload).not.toHaveProperty("until");
  });

  it("sets until and not count for an end-by-date", () => {
    const payload = recurrenceToPayload(Frequency.Weekly, 1, [Weekday.Mon], {
      kind: "until",
      until: "2026-12-31",
    });
    expect(payload.until).toBe("2026-12-31");
    expect(payload).not.toHaveProperty("count");
  });

  it("always carries the frequency through", () => {
    expect(
      recurrenceToPayload(Frequency.Daily, 1, [], {
        kind: "count",
        count: 1,
      }).frequency
    ).toBe(Frequency.Daily);
    expect(
      recurrenceToPayload(Frequency.Monthly, 2, [], {
        kind: "until",
        until: "2026-12-31",
      }).frequency
    ).toBe(Frequency.Monthly);
  });
});

describe("validateRecurrence", () => {
  const TZ = "America/Los_Angeles";
  // Wed, 2026-06-10 in the user's timezone.
  const start = DateTime.fromISO("2026-06-10T10:00:00", { zone: TZ });
  const startWeekday = Weekday.Wed;

  const baseInput = {
    frequency: Frequency.Weekly,
    interval: 1,
    byWeekdays: [Weekday.Wed],
    end: { kind: "count", count: 4 } as const,
    start,
    startWeekday,
    timezone: TZ,
  };

  it("returns null for a fully valid recurrence", () => {
    expect(validateRecurrence(baseInput)).toBeNull();
  });

  it("rejects an interval less than 1", () => {
    expect(validateRecurrence({ ...baseInput, interval: 0 })).toBe(
      "Interval must be at least 1."
    );
    expect(validateRecurrence({ ...baseInput, interval: -2 })).toBe(
      "Interval must be at least 1."
    );
  });

  it("rejects a non-integer or zero count", () => {
    expect(
      validateRecurrence({
        ...baseInput,
        end: { kind: "count", count: 0 },
      })
    ).toBe("Number of occurrences must be at least 1.");
    expect(
      validateRecurrence({
        ...baseInput,
        end: { kind: "count", count: 1.5 },
      })
    ).toBe("Number of occurrences must be at least 1.");
  });

  it("rejects a count above the backend cap", () => {
    expect(
      validateRecurrence({
        ...baseInput,
        end: { kind: "count", count: MAX_OCCURRENCES + 1 },
      })
    ).toBe(`Maximum ${MAX_OCCURRENCES} occurrences.`);
  });

  it("accepts a count at exactly the backend cap", () => {
    expect(
      validateRecurrence({
        ...baseInput,
        end: { kind: "count", count: MAX_OCCURRENCES },
      })
    ).toBeNull();
  });

  it("rejects an empty `until`", () => {
    expect(
      validateRecurrence({
        ...baseInput,
        end: { kind: "until", until: "" },
      })
    ).toBe("Pick an end date.");
  });

  it("rejects an invalid `until` string", () => {
    expect(
      validateRecurrence({
        ...baseInput,
        end: { kind: "until", until: "not-a-date" },
      })
    ).toBe("End date is invalid.");
  });

  it("rejects an `until` before the first session", () => {
    expect(
      validateRecurrence({
        ...baseInput,
        // First session is 2026-06-10; pick a date before it.
        end: { kind: "until", until: "2026-06-09" },
      })
    ).toBe("End date must be on or after the first session.");
  });

  it("accepts an `until` on the same day as the first session", () => {
    expect(
      validateRecurrence({
        ...baseInput,
        end: { kind: "until", until: "2026-06-10" },
      })
    ).toBeNull();
  });

  it("rejects an `until` beyond the 366-day window", () => {
    // start + 366 days inclusive — one day past the cap.
    const tooFar = start.plus({ days: MAX_SPAN_DAYS }).toFormat("yyyy-MM-dd");
    expect(
      validateRecurrence({
        ...baseInput,
        end: { kind: "until", until: tooFar },
      })
    ).toBe(`End date is beyond the ${MAX_SPAN_DAYS}-day window.`);
  });

  it("accepts an `until` exactly at the 366-day cap", () => {
    // The validator includes the start day in the span — so MAX_SPAN_DAYS
    // days *inclusive* means start + (MAX_SPAN_DAYS - 1) days.
    const atCap = start
      .plus({ days: MAX_SPAN_DAYS - 1 })
      .toFormat("yyyy-MM-dd");
    expect(
      validateRecurrence({
        ...baseInput,
        end: { kind: "until", until: atCap },
      })
    ).toBeNull();
  });

  it("skips bounds checks when no start date is set", () => {
    // No start → no upper bound or before-start check, but `until` itself
    // must still be present.
    expect(
      validateRecurrence({
        ...baseInput,
        start: null,
        startWeekday: null,
        end: { kind: "until", until: "2026-06-09" },
      })
    ).toBeNull();
  });

  it("rejects empty by_weekdays on weekly frequency", () => {
    expect(
      validateRecurrence({
        ...baseInput,
        byWeekdays: [],
      })
    ).toBe("Pick at least one day of the week.");
  });

  it("rejects empty by_weekdays on biweekly frequency", () => {
    expect(
      validateRecurrence({
        ...baseInput,
        frequency: Frequency.Biweekly,
        byWeekdays: [],
      })
    ).toBe("Pick at least one day of the week.");
  });

  it("does NOT require by_weekdays for daily frequency", () => {
    expect(
      validateRecurrence({
        ...baseInput,
        frequency: Frequency.Daily,
        byWeekdays: [],
      })
    ).toBeNull();
  });

  it("does NOT require by_weekdays for monthly frequency", () => {
    expect(
      validateRecurrence({
        ...baseInput,
        frequency: Frequency.Monthly,
        byWeekdays: [],
      })
    ).toBeNull();
  });

  it("requires the start_at weekday to be included in by_weekdays on weekly", () => {
    expect(
      validateRecurrence({
        ...baseInput,
        // start is a Wednesday but selection only has Friday.
        byWeekdays: [Weekday.Fri],
      })
    ).toBe(
      `Include ${weekdayLabel(startWeekday)} — it's the day of the week of the first session.`
    );
  });

  it("does not check the start_at weekday rule when no start is set", () => {
    expect(
      validateRecurrence({
        ...baseInput,
        start: null,
        startWeekday: null,
        byWeekdays: [Weekday.Fri],
      })
    ).toBeNull();
  });

  it("returns interval error before end-condition error (precedence)", () => {
    // Both interval and end are invalid; interval check should win.
    expect(
      validateRecurrence({
        ...baseInput,
        interval: 0,
        end: { kind: "count", count: 0 },
      })
    ).toBe("Interval must be at least 1.");
  });
});
