import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DurationField } from "@/components/ui/new-session/duration-field";

const input = () => screen.getByRole("spinbutton", { name: "Duration in minutes" });

describe("DurationField: a cleared box", () => {
  it("restores the previous duration on blur instead of the minimum", () => {
    const onChange = vi.fn();
    render(<DurationField value={50} onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.blur(input());
    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue(50);
  });

  it("restores it on Enter too", () => {
    const onChange = vi.fn();
    render(<DurationField value={45} onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue(45);
  });

  it("still commits a typed number after a clear", () => {
    const onChange = vi.fn();
    render(<DurationField value={50} onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.change(input(), { target: { value: "30" } });
    fireEvent.blur(input());
    expect(onChange).toHaveBeenLastCalledWith(30);
  });
});
