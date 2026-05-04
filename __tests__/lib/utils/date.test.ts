import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import { formatDateWithTime } from "@/lib/utils/date";

describe("formatDateWithTime", () => {
  const date = DateTime.fromISO("2026-03-05T14:00:00", { zone: "utc" });

  it("uses 'at' as the default separator (back-compat)", () => {
    expect(formatDateWithTime(date)).toBe("Mar 5, 2026 at 2:00 PM");
  });

  it("accepts a custom separator", () => {
    expect(formatDateWithTime(date, "·")).toBe("Mar 5, 2026 · 2:00 PM");
  });
});
