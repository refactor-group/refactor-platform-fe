import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ItemStatus, actionStatusToString } from "@/types/general";
import { StatusGlyph } from "@/components/ui/status/status-glyph";

const ALL = Object.values(ItemStatus);

describe("StatusGlyph", () => {
  it.each(ALL)("renders an accessible image for %s", (status) => {
    render(<StatusGlyph status={status} />);
    const glyph = screen.getByRole("img", { name: actionStatusToString(status) });
    expect(glyph).toHaveAttribute("data-status", status);
  });

  it.each([
    [ItemStatus.Completed, "fill-positive-solid"],
    [ItemStatus.InProgress, "fill-brand"],
    [ItemStatus.OnHold, "fill-on-hold-fill"],
    [ItemStatus.NotStarted, "stroke-status-idle"],
    [ItemStatus.WontDo, "fill-faint"],
  ])("draws %s with %s", (status, cls) => {
    const { container } = render(<StatusGlyph status={status} />);
    expect(container.querySelector(`.${cls}`)).not.toBeNull();
  });

  it("hides a decorative glyph from assistive tech", () => {
    const { container } = render(
      <StatusGlyph status={ItemStatus.Completed} decorative />
    );
    expect(screen.queryByRole("img")).toBeNull();
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("data-status", ItemStatus.Completed);
  });
});
