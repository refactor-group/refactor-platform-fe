import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RadioCardItem, RadioGroup } from "@/components/ui/radio-group";

describe("RadioCardItem", () => {
  it("is a radio named by its title, with its description", () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup value="one" onValueChange={onValueChange}>
        <RadioCardItem value="one" title="This session only" description="The rest of the series stays where it is." />
        <RadioCardItem value="following" title="This and following sessions" description="Future sessions move to the new weekday and time." />
      </RadioGroup>
    );
    expect(screen.getByRole("radio", { name: "This session only" })).toBeChecked();
    expect(screen.getByText("Future sessions move to the new weekday and time.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "This and following sessions" }));
    expect(onValueChange).toHaveBeenCalledWith("following");
  });
});
