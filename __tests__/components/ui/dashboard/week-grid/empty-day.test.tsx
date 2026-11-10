import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { None, Some } from "@/types/option";
import { EmptyDay } from "@/components/ui/dashboard/week-grid/empty-day";

const DAY = DateTime.fromISO("2026-11-09", { zone: "America/Chicago" });

afterEach(cleanup);

describe("EmptyDay", () => {
  it("says No sessions today on an empty today", () => {
    render(<EmptyDay day={DAY} isToday onSchedule={None} />);
    expect(screen.getByText("No sessions today")).toBeInTheDocument();
  });

  it("says nothing on any other empty day", () => {
    render(<EmptyDay day={DAY} isToday={false} onSchedule={None} />);
    expect(screen.queryByText("No sessions today")).not.toBeInTheDocument();
    render(<EmptyDay day={DAY} isToday={false} onSchedule={Some(vi.fn())} />);
    expect(screen.queryByText("No sessions today")).not.toBeInTheDocument();
  });

  it("keeps Schedule on an empty today for a coach", () => {
    const onSchedule = vi.fn();
    render(<EmptyDay day={DAY} isToday onSchedule={Some(onSchedule)} />);
    expect(screen.getByText("No sessions today")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Schedule on Monday, November 9" }));
    expect(onSchedule).toHaveBeenCalledOnce();
  });
});
