import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TimeField } from "@/components/ui/new-session/time-field";
import { None, Some } from "@/types/option";
import { at } from "./fixtures";

const SUGGESTIONS = [at("2026-08-18T09:00"), at("2026-08-18T13:00"), at("2026-08-18T15:30")];

describe("TimeField", () => {
  it("lists the suggestions as chips", () => {
    render(<TimeField suggestions={SUGGESTIONS} value={None} onChange={vi.fn()} />);
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "9:00 AM" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1:00 PM" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3:30 PM" })).toBeInTheDocument();
  });

  it("picks a suggestion as HH:mm", () => {
    const onChange = vi.fn();
    render(<TimeField suggestions={SUGGESTIONS} value={None} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "1:00 PM" }));
    expect(onChange).toHaveBeenCalledWith("13:00");
  });

  it("presses the chip that matches the value", () => {
    render(<TimeField suggestions={SUGGESTIONS} value={Some("15:30")} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "3:30 PM" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "9:00 AM" })).toHaveAttribute("aria-pressed", "false");
  });

  it("takes a typed time", () => {
    const onChange = vi.fn();
    render(<TimeField suggestions={SUGGESTIONS} value={None} onChange={onChange} />);
    const input = screen.getByLabelText("Start time");
    expect(input).toHaveValue("");
    fireEvent.change(input, { target: { value: "14:45" } });
    expect(onChange).toHaveBeenCalledWith("14:45");
  });

  it("ignores a cleared time input", () => {
    const onChange = vi.fn();
    render(<TimeField suggestions={SUGGESTIONS} value={Some("09:00")} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("still offers the input with no suggestions", () => {
    render(<TimeField suggestions={[]} value={None} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Start time")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
