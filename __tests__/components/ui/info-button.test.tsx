import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InfoButton, InfoButtonSize } from "@/components/ui/info-button";

describe("InfoButton", () => {
  it("is named for what it explains and shows the title and text on click", () => {
    render(<InfoButton title="Time zone" info="Yours unless you pick another." size={InfoButtonSize.Label} />);
    expect(screen.queryByText("Yours unless you pick another.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "About Time zone" }));
    expect(screen.getByText("Yours unless you pick another.")).toBeInTheDocument();
    expect(screen.getAllByText("Time zone")[0]).toHaveClass("font-medium");
  });

  it.each([
    [InfoButtonSize.Label, "h-8"],
    [InfoButtonSize.Card, "h-10"],
  ])("sizes the %s button", (size, height) => {
    render(<InfoButton title="Coach" info="Runs the sessions." size={size} />);
    expect(screen.getByRole("button", { name: "About Coach" })).toHaveClass(height);
  });
});
