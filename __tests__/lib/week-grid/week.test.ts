import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { None, Some } from "@/types/option";
import { groupByDay, weekOf, weekRange, weekSubline, weekTitle } from "@/lib/week-grid/week";

const TZ = "America/Chicago";
// Tuesday, August 18 2026, 1:45 PM in Chicago.
const NOW = DateTime.fromISO("2026-08-18T13:45:00", { zone: TZ });

describe("weekOf", () => {
  it("starts the current week on Monday at midnight in the viewer's zone", () => {
    const week = weekOf(0, NOW, TZ);
    expect(week.start.toISO()).toBe(DateTime.fromISO("2026-08-17T00:00:00", { zone: TZ }).toISO());
    expect(week.start.zoneName).toBe(TZ);
  });

  it("lists seven local midnights, Monday through Sunday", () => {
    const days = weekOf(0, NOW, TZ).days.map((d) => d.toISODate());
    expect(days).toEqual([
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
    ]);
    expect(weekOf(0, NOW, TZ).days.every((d) => d.hour === 0 && d.minute === 0)).toBe(true);
  });

  it("steps whole weeks either way", () => {
    expect(weekOf(-1, NOW, TZ).start.toISODate()).toBe("2026-08-10");
    expect(weekOf(2, NOW, TZ).start.toISODate()).toBe("2026-08-31");
  });

  it("keeps local midnights across a daylight-saving change", () => {
    // US clocks spring forward on Sunday, March 8 2026.
    const march = DateTime.fromISO("2026-03-04T09:00:00", { zone: TZ });
    const days = weekOf(0, march, TZ).days;
    expect(days.map((d) => d.toISODate())).toEqual([
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-07",
      "2026-03-08",
    ]);
    expect(days.every((d) => d.hour === 0)).toBe(true);
  });

  it("uses the viewer's zone, not UTC, to decide which week now is in", () => {
    // Sunday 11:30 PM in Los Angeles is already Monday in UTC.
    const lateSunday = DateTime.fromISO("2026-08-23T23:30:00", { zone: "America/Los_Angeles" });
    expect(weekOf(0, lateSunday, "America/Los_Angeles").start.toISODate()).toBe("2026-08-17");
  });
});

describe("weekTitle", () => {
  it.each([
    [0, "This week"],
    [-1, "Last week"],
    [1, "Next week"],
    [2, "Week of Aug 31"],
    [-2, "Week of Aug 3"],
  ])("offset %i reads %s", (offset, title) => {
    expect(weekTitle(offset, weekOf(offset, NOW, TZ))).toBe(title);
  });
});

describe("weekRange", () => {
  it("names the month once inside a month, with the year", () => {
    expect(weekRange(weekOf(0, NOW, TZ))).toBe("Aug 17 – 23, 2026");
  });

  it("names both months across a month boundary", () => {
    expect(weekRange(weekOf(2, NOW, TZ))).toBe("Aug 31 – Sep 6, 2026");
  });

  it("names both years across a year boundary", () => {
    const newYear = weekOf(0, DateTime.fromISO("2026-12-30T12:00:00", { zone: TZ }), TZ);
    expect(weekRange(newYear)).toBe("Dec 28, 2026 – Jan 3, 2027");
  });

  it("shows the year for weeks in a later year", () => {
    const january = weekOf(0, DateTime.fromISO("2027-01-13T12:00:00", { zone: TZ }), TZ);
    expect(weekRange(january)).toBe("Jan 11 – 17, 2027");
  });
});

describe("weekSubline", () => {
  it.each([
    [4, Some(2), "4 sessions · 2 today"],
    [1, Some(1), "1 session · 1 today"],
    [3, Some(0), "3 sessions"],
    [3, None, "3 sessions"],
    [0, None, "0 sessions"],
  ])("%i visible, %o today reads %s", (visible, today, text) => {
    expect(weekSubline(visible, today)).toBe(text);
  });
});

describe("groupByDay", () => {
  const week = weekOf(0, NOW, TZ);
  const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ });
  const items = [
    { id: "thu-10", start: at("2026-08-20T10:00:00") },
    { id: "tue-1630", start: at("2026-08-18T16:30:00") },
    { id: "tue-1430", start: at("2026-08-18T14:30:00") },
    { id: "next-mon", start: at("2026-08-24T09:00:00") },
    { id: "last-sun", start: at("2026-08-16T22:00:00") },
  ];
  const groups = groupByDay(items, (i) => i.start, week, NOW);

  it("returns one group per day, Monday first", () => {
    expect(groups.map((g) => g.day.toISODate())).toEqual(week.days.map((d) => d.toISODate()));
  });

  it("puts each item on its local day, sorted by start, and drops items outside the week", () => {
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([
      [],
      ["tue-1430", "tue-1630"],
      [],
      ["thu-10"],
      [],
      [],
      [],
    ]);
  });

  it("marks today and the days before it", () => {
    expect(groups.map((g) => g.isToday)).toEqual([false, true, false, false, false, false, false]);
    expect(groups.map((g) => g.isPast)).toEqual([true, false, false, false, false, false, false]);
  });
});
