import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DurationField } from "@/components/ui/new-session/duration-field";

const input = () => screen.getByRole("spinbutton", { name: "Duration in minutes" });

function type(value: string) {
  fireEvent.change(input(), { target: { value } });
  fireEvent.blur(input());
}

describe("DurationField", () => {
  it("presses the chip that matches the value", () => {
    render(<DurationField value={50} onChange={vi.fn()} />);
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "50 min" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "45 min" })).toHaveAttribute("aria-pressed", "false");
  });

  it("presses no chip for a value between them", () => {
    render(<DurationField value={55} onChange={vi.fn()} />);
    for (const name of ["30 min", "45 min", "50 min", "60 min"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("picks a chip", () => {
    const onChange = vi.fn();
    render(<DurationField value={50} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "45 min" }));
    expect(onChange).toHaveBeenCalledWith(45);
  });

  it("steps by 5", () => {
    const onChange = vi.fn();
    render(<DurationField value={50} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase duration" }));
    expect(onChange).toHaveBeenLastCalledWith(55);
    fireEvent.click(screen.getByRole("button", { name: "Decrease duration" }));
    expect(onChange).toHaveBeenLastCalledWith(45);
  });

  it("disables the steps at the bounds", () => {
    const { rerender } = render(<DurationField value={15} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Decrease duration" })).toBeDisabled();
    rerender(<DurationField value={180} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Increase duration" })).toBeDisabled();
  });

  it("rounds and clamps a typed value when it loses focus", () => {
    const onChange = vi.fn();
    render(<DurationField value={50} onChange={onChange} />);
    type("52");
    expect(onChange).toHaveBeenLastCalledWith(50);
    type("400");
    expect(onChange).toHaveBeenLastCalledWith(180);
    type("7");
    expect(onChange).toHaveBeenLastCalledWith(15);
  });

  it("doesn't emit while typing", () => {
    const onChange = vi.fn();
    render(<DurationField value={50} onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "5" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits on Enter", () => {
    const onChange = vi.fn();
    render(<DurationField value={50} onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "90" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(90);
  });

  it("follows a new value from outside", () => {
    const { rerender } = render(<DurationField value={50} onChange={vi.fn()} />);
    rerender(<DurationField value={60} onChange={vi.fn()} />);
    expect(input()).toHaveValue(60);
  });
});
