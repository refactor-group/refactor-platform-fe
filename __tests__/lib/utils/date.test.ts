import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import { formatDueDate } from "@/lib/utils/date";

describe("formatDueDate", () => {
  it("should return 'Due today' for today's date", () => {
    const today = DateTime.now();
    expect(formatDueDate(today)).toBe("Due today");
  });

  it("should return 'Due tomorrow' for tomorrow's date", () => {
    const tomorrow = DateTime.now().plus({ days: 1 });
    expect(formatDueDate(tomorrow)).toBe("Due tomorrow");
  });

  it("should return 'Due in N days' for dates within a week", () => {
    const inThreeDays = DateTime.now().plus({ days: 3 });
    expect(formatDueDate(inThreeDays)).toBe("Due in 3 days");
  });

  it("should return 'Due MMM d' for dates beyond a week", () => {
    const farFuture = DateTime.fromISO("2026-07-15");
    expect(formatDueDate(farFuture)).toBe("Due Jul 15");
  });

  it("should return '1 day overdue' for yesterday", () => {
    const yesterday = DateTime.now().minus({ days: 1 });
    expect(formatDueDate(yesterday)).toBe("1 day overdue");
  });

  it("should return 'N days overdue' for multiple days past", () => {
    const fiveDaysAgo = DateTime.now().minus({ days: 5 });
    expect(formatDueDate(fiveDaysAgo)).toBe("5 days overdue");
  });

  it("should use date-only comparison (items due later today are not overdue)", () => {
    // An item due at end of today should still be "Due today", not overdue
    const endOfToday = DateTime.now().endOf("day");
    expect(formatDueDate(endOfToday)).toBe("Due today");
  });

  it("should handle the boundary between 6 and 7 days", () => {
    const sixDays = DateTime.now().plus({ days: 6 });
    const sevenDays = DateTime.now().plus({ days: 7 });

    expect(formatDueDate(sixDays)).toBe("Due in 6 days");
    // 7 days out should use the "Due MMM d" format
    expect(formatDueDate(sevenDays)).toMatch(/^Due [A-Z][a-z]+ \d+$/);
  });
});
