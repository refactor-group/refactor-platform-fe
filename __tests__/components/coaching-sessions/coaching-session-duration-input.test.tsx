import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CoachingSessionDurationInput } from "@/components/ui/coaching-sessions/coaching-session-duration-input";

describe("CoachingSessionDurationInput", () => {
  it("renders a single combobox input with the current value", () => {
    render(<CoachingSessionDurationInput value={45} onChange={vi.fn()} />);
    const input = screen.getByRole("combobox", {
      name: /duration in minutes/i,
    });
    expect(input).toHaveValue("45");
  });

  it("emits onChange with the parsed integer when the user types", () => {
    const onChange = vi.fn();
    render(<CoachingSessionDurationInput value={60} onChange={onChange} />);
    const input = screen.getByRole("combobox", {
      name: /duration in minutes/i,
    });
    fireEvent.change(input, { target: { value: "75" } });
    expect(onChange).toHaveBeenLastCalledWith(75);
  });

  it("does not emit onChange with NaN when the input is cleared", () => {
    const onChange = vi.fn();
    render(<CoachingSessionDurationInput value={60} onChange={onChange} />);
    const input = screen.getByRole("combobox", {
      name: /duration in minutes/i,
    });
    fireEvent.change(input, { target: { value: "" } });
    const nanCalls = onChange.mock.calls.filter((call) =>
      Number.isNaN(call[0])
    );
    expect(nanCalls).toEqual([]);
  });

  it("opens a presets popover with all six common durations when the chevron is clicked", async () => {
    const user = userEvent.setup();
    render(<CoachingSessionDurationInput value={75} onChange={vi.fn()} />);
    const trigger = screen.getByRole("button", {
      name: /show duration presets/i,
    });
    await user.click(trigger);

    const options = screen
      .getAllByRole("option")
      .map((o) => o.textContent?.trim());
    expect(options).toEqual([
      "15 minutes",
      "30 minutes",
      "45 minutes",
      "60 minutes",
      "90 minutes",
      "120 minutes",
    ]);
  });

  it("emits onChange with the preset value when a preset is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CoachingSessionDurationInput value={75} onChange={onChange} />);
    await user.click(
      screen.getByRole("button", { name: /show duration presets/i })
    );
    await user.click(screen.getByRole("option", { name: "30 minutes" }));
    expect(onChange).toHaveBeenLastCalledWith(30);
  });
});
