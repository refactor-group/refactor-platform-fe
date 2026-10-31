import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { TodayBlock } from "@/components/ui/join-session/today-block";

const start = DateTime.fromISO("2026-08-25T14:30", { zone: "America/Chicago" });

function entry(n: number) {
  return {
    session: { id: `s${n}`, start, title: `Session ${n}`, liveness: "none" as const },
    person: { userId: `u${n}`, firstName: `P${n}`, fullName: `Person ${n}`, initials: `P${n}` },
  };
}

describe("TodayBlock", () => {
  it("renders nothing without entries", () => {
    const { container } = render(<TodayBlock entries={[]} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a labelled row per entry", () => {
    render(<TodayBlock entries={[entry(1), entry(2)]} onSelect={vi.fn()} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
