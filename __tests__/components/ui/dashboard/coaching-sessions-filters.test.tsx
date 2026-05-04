import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import {
  formatTimeWindowDateRange,
  SessionTimeWindow,
} from "@/components/ui/dashboard/coaching-sessions-filters";

// ── formatTimeWindowDateRange ─────────────────────────────────────────────
//
// Pure helper that resolves a `SessionTimeWindow` into a calendar-date range
// string, anchored at a caller-provided `now`. Used by both the header chip
// (which shows the *current* range) and each dropdown option (which shows
// what the user would get on selection). Output format:
//
//   - Same year:    "MMM d – MMM d"           e.g. "Apr 27 – May 11"
//   - Cross-year:   "MMM d, yyyy – MMM d, yyyy" e.g. "Sep 29, 2026 – Mar 28, 2027"
//
// The same-year fast path keeps the chip narrow in the common case; the
// cross-year fallback only kicks in at ±90d near year-end, which is rare but
// must remain unambiguous (otherwise "Dec 28 – Jan 11" would read as the
// same year's January).

describe("formatTimeWindowDateRange", () => {
  it("returns the same-year MMM d format when the range is within a single year", () => {
    const now = DateTime.fromISO("2026-05-04T12:00:00", { zone: "utc" });

    expect(formatTimeWindowDateRange(SessionTimeWindow.Day, now)).toBe(
      "May 3 – May 5"
    );
    expect(formatTimeWindowDateRange(SessionTimeWindow.Week, now)).toBe(
      "Apr 27 – May 11"
    );
    expect(formatTimeWindowDateRange(SessionTimeWindow.Month, now)).toBe(
      "Apr 4 – Jun 3"
    );
  });

  it("falls back to MMM d, yyyy when the range crosses a year boundary", () => {
    // Late December — ±90 days extends into the previous and next year.
    const now = DateTime.fromISO("2026-12-28T12:00:00", { zone: "utc" });

    expect(formatTimeWindowDateRange(SessionTimeWindow.Quarter, now)).toBe(
      "Sep 29, 2026 – Mar 28, 2027"
    );
  });

  it("uses the provided anchor exactly — does not round to day boundaries", () => {
    // Same-day window (±24h around late-evening) shouldn't shift dates due
    // to local-zone interpretation. The helper must respect whatever `now`
    // it's given.
    const now = DateTime.fromISO("2026-05-04T22:00:00", { zone: "utc" });

    // ±24h from 10pm May 4 UTC = 10pm May 3 UTC → 10pm May 5 UTC
    // The format is `LLL d` (no time component), so calendar days are
    // May 3 and May 5.
    expect(formatTimeWindowDateRange(SessionTimeWindow.Day, now)).toBe(
      "May 3 – May 5"
    );
  });
});
