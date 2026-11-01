import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ItemStatus, actionStatusToString } from "@/types/general";
import { StatusPill } from "@/components/ui/status/status-pill";

// Written out independently of the component's map, so a wrong color fails here.
const EXPECTED: Array<[ItemStatus, string[]]> = [
  [ItemStatus.NotStarted, ["bg-fill", "text-ink-2"]],
  [ItemStatus.InProgress, ["bg-brand-tint", "text-brand-strong"]],
  [ItemStatus.OnHold, ["bg-on-hold-fill", "text-on-hold-text"]],
  [ItemStatus.Completed, ["bg-positive-tint", "text-positive"]],
  [ItemStatus.WontDo, ["bg-fill", "text-muted-foreground"]],
];

describe("StatusPill", () => {
  it("covers every status", () => {
    expect(EXPECTED.map(([status]) => status).sort()).toEqual(
      Object.values(ItemStatus).sort()
    );
  });

  it.each(EXPECTED)("renders %s with its label and colors", (status, classes) => {
    render(<StatusPill status={status} />);
    expect(screen.getByText(actionStatusToString(status))).toHaveClass(...classes);
  });
});
