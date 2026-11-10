import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { None, Some } from "@/types/option";
import { agendaDay, weekOf } from "@/lib/week-grid/week";

const TZ = "America/Chicago";
// Wednesday, August 19 2026, 10:00 in Chicago.
const NOW = DateTime.fromISO("2026-08-19T10:00:00", { zone: TZ });

describe("agendaDay", () => {
  it("defaults to today on the current week", () => {
    expect(agendaDay(weekOf(0, NOW, TZ), None, NOW).toISODate()).toBe("2026-08-19");
  });

  it("defaults to Monday on any other week", () => {
    expect(agendaDay(weekOf(1, NOW, TZ), None, NOW).toISODate()).toBe("2026-08-24");
    expect(agendaDay(weekOf(-1, NOW, TZ), None, NOW).toISODate()).toBe("2026-08-10");
  });

  it("uses a chosen day inside the week", () => {
    expect(agendaDay(weekOf(0, NOW, TZ), Some("2026-08-22"), NOW).toISODate()).toBe("2026-08-22");
  });

  it("ignores a chosen day from another week", () => {
    expect(agendaDay(weekOf(0, NOW, TZ), Some("2026-08-26"), NOW).toISODate()).toBe("2026-08-19");
  });

  it("returns a local midnight in the week's zone", () => {
    const day = agendaDay(weekOf(0, NOW, TZ), None, NOW);
    expect(day.zoneName).toBe(TZ);
    expect(day.toFormat("HH:mm")).toBe("00:00");
  });
});
