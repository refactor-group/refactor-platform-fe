import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ItemStatus, actionStatusToString } from "@/types/general";
import { StatusPill, STATUS_PILL_CLASSES } from "@/components/ui/status/status-pill";

describe("StatusPill", () => {
  it.each(Object.values(ItemStatus))("renders %s label and classes", (status) => {
    render(<StatusPill status={status} />);
    const pill = screen.getByText(actionStatusToString(status));
    for (const cls of STATUS_PILL_CLASSES[status].split(" ")) {
      expect(pill).toHaveClass(cls);
    }
  });

  it("uses the brand tint for In Progress", () => {
    render(<StatusPill status={ItemStatus.InProgress} />);
    expect(screen.getByText("In Progress")).toHaveClass("bg-brand-tint");
  });

  it("uses the positive tint for Completed", () => {
    render(<StatusPill status={ItemStatus.Completed} />);
    expect(screen.getByText("Completed")).toHaveClass("bg-positive-tint");
  });
});
