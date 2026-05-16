import { describe, it, expect } from "vitest";
import {
  Frequency,
  Weekday,
  WEEKDAYS_ORDERED,
  frequencyLabel,
  frequencySupportsWeekdays,
  recurrenceToPayload,
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
