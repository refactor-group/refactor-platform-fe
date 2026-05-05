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
//   - Same year:    "MMM d – MMM d"            e.g. "May 1 – May 8"
//   - Cross-year:   "MMM d, yyyy – MMM d, yyyy" e.g. "Nov 13, 2026 – Feb 11, 2027"
//
// The same-year fast path keeps the chip narrow in the common case; the
// cross-year fallback only kicks in for the 3-month option near year-end,
// which is rare but must remain unambiguous.
//
// `TIME_WINDOW_DURATIONS` are *half-spans* — the helper applies them
// symmetrically (`now ± duration`), so the total visible span equals the
// labeled size (24h, 7d, 30d, 90d).

describe("formatTimeWindowDateRange", () => {
  it("returns the same-year MMM d format when the range is within a single year", () => {
    const now = DateTime.fromISO("2026-05-04T12:00:00", { zone: "utc" });

    // 1 day → ±12h → May 4 00:00 UTC – May 5 00:00 UTC
    expect(formatTimeWindowDateRange(SessionTimeWindow.Day, now)).toBe(
      "May 4 – May 5"
    );
    // 1 week → ±3.5d → May 1 00:00 UTC – May 8 00:00 UTC
    expect(formatTimeWindowDateRange(SessionTimeWindow.Week, now)).toBe(
      "May 1 – May 8"
    );
    // 1 month → ±15d → Apr 19 12:00 UTC – May 19 12:00 UTC
    expect(formatTimeWindowDateRange(SessionTimeWindow.Month, now)).toBe(
      "Apr 19 – May 19"
    );
  });

  it("falls back to MMM d, yyyy when the range crosses a year boundary", () => {
    // Late December — 3-month half-span (±45d) extends into the previous and
    // next year. With a noon anchor: from = Nov 13 12:00 2026, to = Feb 11
    // 12:00 2027.
    const now = DateTime.fromISO("2026-12-28T12:00:00", { zone: "utc" });

    expect(formatTimeWindowDateRange(SessionTimeWindow.Quarter, now)).toBe(
      "Nov 13, 2026 – Feb 11, 2027"
    );
  });

  it("uses the provided anchor exactly — does not round to day boundaries", () => {
    // Late-evening anchor: ±12h still produces a 24-hour total span but the
    // calendar days shift forward. The helper must respect whatever `now`
    // it's given.
    const now = DateTime.fromISO("2026-05-04T22:00:00", { zone: "utc" });

    // ±12h from 10pm May 4 UTC = 10am May 4 UTC → 10am May 5 UTC.
    // `LLL d` drops the time, so calendar days are May 4 and May 5.
    expect(formatTimeWindowDateRange(SessionTimeWindow.Day, now)).toBe(
      "May 4 – May 5"
    );
  });
});
