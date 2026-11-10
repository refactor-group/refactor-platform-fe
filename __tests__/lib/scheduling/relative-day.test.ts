import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { relativeDayText } from "@/lib/scheduling-copy";

const TZ = "America/Chicago";
const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ });
// Monday, November 9 2026, 11:00 PM.
const NOW = at("2026-11-09T23:00");

describe("relativeDayText", () => {
  it.each([
    ["2026-11-09T23:30", "Today"],
    ["2026-11-10T00:30", "Tomorrow"],
    ["2026-11-12T09:00", "In 3 days"],
    ["2026-11-22T09:00", "In 13 days"],
    ["2026-11-23T09:00", "In 2 weeks"],
    ["2026-11-30T09:00", "In 3 weeks"],
  ])("%s reads %s", (start, text) => {
    expect(relativeDayText(at(start), NOW)).toBe(text);
  });

  it("counts calendar days in the session's zone, not hours", () => {
    const utcNow = DateTime.fromISO("2026-11-10T05:00:00Z", { zone: "utc" });
    expect(relativeDayText(at("2026-11-10T09:00"), utcNow)).toBe("Tomorrow");
  });
});
