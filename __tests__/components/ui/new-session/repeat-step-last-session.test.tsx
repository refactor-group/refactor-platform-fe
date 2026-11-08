import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { None, Some, type Option } from "@/types/option";
import { Frequency, Weekday, type RecurrenceEnd } from "@/types/recurrence";
import { RepeatStep } from "@/components/ui/new-session/repeat-step";
import type { RepeatModel } from "@/lib/new-session-dialog-model";

function renderStep(end: RecurrenceEnd, lastSession: Option<DateTime>) {
  const model: RepeatModel = {
    repeat: { kind: "repeat", frequency: Frequency.Weekly, interval: 1, end },
    optional: true,
    locked: false,
    byWeekdays: [Weekday.Sun],
    lockedWeekday: Weekday.Sun,
    defaultEnd: { count: 6, until: "2027-01-03" },
    seriesCadence: None,
    error: None,
    lastSession,
    onRepeatChange: vi.fn(),
    onWeekdaysChange: vi.fn(),
    onEndChange: vi.fn(),
  } as RepeatModel;
  render(<RepeatStep {...model} />);
}

const DEC_13 = DateTime.fromISO("2026-12-13T15:00", { zone: "America/Chicago" });

describe("Repeat step: the last session", () => {
  it("names the last session beside After N sessions", () => {
    renderStep({ kind: "count", count: 6 }, Some(DEC_13));
    expect(screen.getByText(/sessions, the last on Sun, Dec 13/)).toBeInTheDocument();
  });

  it("says nothing extra without a last session", () => {
    renderStep({ kind: "count", count: 6 }, None);
    expect(screen.queryByText(/the last on/)).not.toBeInTheDocument();
  });

  it("says nothing extra when ending on a date", () => {
    renderStep({ kind: "until", until: "2027-01-03" }, Some(DEC_13));
    expect(screen.queryByText(/the last on/)).not.toBeInTheDocument();
  });
});
