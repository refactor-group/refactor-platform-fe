import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Chip, FilterChip } from "@/components/ui/chip";

describe("Chip", () => {
  it("reflects selected state", () => {
    render(
      <>
        <Chip selected>On</Chip>
        <Chip selected={false}>Off</Chip>
      </>
    );
    const on = screen.getByRole("button", { name: "On" });
    expect(on).toHaveAttribute("aria-pressed", "true");
    expect(on).toHaveClass("bg-primary");
    const off = screen.getByRole("button", { name: "Off" });
    expect(off).toHaveAttribute("aria-pressed", "false");
    expect(off).toHaveClass("bg-fill");
  });

  it("calls onClick once per click", async () => {
    const onClick = vi.fn();
    render(
      <Chip selected={false} onClick={onClick}>
        Tap
      </Chip>
    );
    await userEvent.click(screen.getByRole("button", { name: "Tap" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("FilterChip", () => {
  it("renders its label and clears on click", async () => {
    const onClear = vi.fn();
    render(<FilterChip label="Ehab" onClear={onClear} />);
    expect(screen.getByText("Ehab")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear Ehab" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
