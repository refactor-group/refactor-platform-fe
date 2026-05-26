import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CoachingSessionDurationInput } from "@/components/ui/coaching-sessions/coaching-session-duration-input";

describe("CoachingSessionDurationInput", () => {
  it("renders a single number input with the current value", () => {
    render(<CoachingSessionDurationInput value={45} onChange={vi.fn()} />);
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveValue(45);
  });

  it("links the input to a datalist of presets so the dropdown surfaces 15/30/45/60/90/120", () => {
    render(<CoachingSessionDurationInput value={60} onChange={vi.fn()} />);
    const input = screen.getByRole("spinbutton");
    const listId = input.getAttribute("list");
    expect(listId).toBeTruthy();
    const datalist = document.getElementById(listId!);
    expect(datalist).toBeInTheDocument();
    const optionValues = Array.from(
      datalist!.querySelectorAll("option")
    ).map((o) => Number(o.getAttribute("value")));
    expect(optionValues).toEqual([15, 30, 45, 60, 90, 120]);
  });

  it("emits onChange with the parsed integer when the value changes", () => {
    const onChange = vi.fn();
    render(<CoachingSessionDurationInput value={60} onChange={onChange} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "75" } });
    expect(onChange).toHaveBeenLastCalledWith(75);
  });

  it("does not emit onChange with NaN when the value is cleared", () => {
    const onChange = vi.fn();
    render(<CoachingSessionDurationInput value={60} onChange={onChange} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "" } });
    const nanCalls = onChange.mock.calls.filter((call) =>
      Number.isNaN(call[0])
    );
    expect(nanCalls).toEqual([]);
  });

  it("enforces the 1..=480 range via min/max attributes on the input", () => {
    render(<CoachingSessionDurationInput value={60} onChange={vi.fn()} />);
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "480");
  });
});
