import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GoalPickerPopover } from "@/components/ui/goal-picker-popover";
import { GoalPill } from "@/components/ui/goal-pill";
import { createMockGoal } from "../../../test-utils";

function Wrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

const GOALS = [
  createMockGoal({ id: "goal-1", title: "Improve communication" }),
  createMockGoal({ id: "goal-2", title: "Build leadership skills" }),
];

describe("GoalPill", () => {
  it("renders the goal title", () => {
    render(
      <Wrapper>
        <GoalPill title="Improve communication" />
      </Wrapper>
    );

    expect(screen.getByTestId("goal-pill")).toHaveTextContent("Improve communication");
  });

  it("does not render unlink button when onUnlink is not provided", () => {
    render(
      <Wrapper>
        <GoalPill title="Improve communication" />
      </Wrapper>
    );

    expect(screen.queryByRole("button", { name: /unlink goal/i })).not.toBeInTheDocument();
  });

  it("renders unlink button and calls onUnlink when clicked", async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();

    render(
      <Wrapper>
        <GoalPill title="Improve communication" onUnlink={onUnlink} />
      </Wrapper>
    );

    await user.click(screen.getByRole("button", { name: /unlink goal/i }));
    expect(onUnlink).toHaveBeenCalledOnce();
  });
});

describe("GoalPickerPopover", () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  it("renders 'None' placeholder when no goal is selected", () => {
    render(
      <Wrapper>
        <GoalPickerPopover goals={GOALS} onChange={onChange} />
      </Wrapper>
    );

    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("renders the selected goal title when a goal is linked", () => {
    render(
      <Wrapper>
        <GoalPickerPopover
          goals={GOALS}
          selectedGoalId="goal-1"
          onChange={onChange}
        />
      </Wrapper>
    );

    expect(screen.getByText("Improve communication")).toBeInTheDocument();
  });

  it("calls onChange with goal ID when a goal is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <GoalPickerPopover goals={GOALS} onChange={onChange} />
      </Wrapper>
    );

    await user.click(screen.getByText("None"));

    const popover = await screen.findByRole("dialog");
    await user.click(within(popover).getByText("Improve communication"));

    expect(onChange).toHaveBeenCalledWith("goal-1");
  });

  it("shows unlink option when a goal is selected and calls onChange with undefined", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <GoalPickerPopover
          goals={GOALS}
          selectedGoalId="goal-1"
          onChange={onChange}
        />
      </Wrapper>
    );

    await user.click(screen.getByText("Improve communication"));

    const popover = await screen.findByRole("dialog");
    await user.click(within(popover).getByText("Unlink"));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("does not open popover when disabled", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <GoalPickerPopover goals={GOALS} onChange={onChange} disabled />
      </Wrapper>
    );

    await user.click(screen.getByText("None"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
