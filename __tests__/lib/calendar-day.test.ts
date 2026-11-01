import { afterEach, describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { calendarDayOf, pickedDayIn } from "@/lib/timezone-utils";

const PROFILE = "America/Chicago";
const BROWSERS = ["UTC", "Asia/Tokyo", "America/Chicago", "America/Los_Angeles"];

describe.each(BROWSERS)("calendar days with the browser on %s", (browserZone) => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("keeps the picked day in the profile's timezone", () => {
    process.env.TZ = browserZone;
    // What the calendar hands back for Oct 15: midnight in the browser's zone.
    const picked = new Date(2026, 9, 15);

    const start = pickedDayIn(picked, PROFILE).set({ hour: 10 });

    expect(start.toISO()).toBe("2026-10-15T10:00:00.000-05:00");
  });

  it("shows a stored session on its profile-local day", () => {
    process.env.TZ = browserZone;
    // 9 PM Nov 4 in Chicago is already Nov 5 in UTC and Tokyo.
    const local = DateTime.fromISO("2026-11-05T03:00:00", { zone: "utc" }).setZone(PROFILE);

    const shown = calendarDayOf(local);

    expect([shown.getFullYear(), shown.getMonth() + 1, shown.getDate()]).toEqual([2026, 11, 4]);
    expect(pickedDayIn(shown, PROFILE).toISODate()).toBe("2026-11-04");
  });
});
