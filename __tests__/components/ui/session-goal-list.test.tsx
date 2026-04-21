import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SessionGoalList } from "@/components/ui/session-goal-list";
import { createMockGoal } from "../../test-utils";
import { DEFAULT_GOAL_TITLE } from "@/types/goal";

/**
 * Test Suite: SessionGoalList
 * Story: "Render a session's linked goals as a tight dot-and-title list"
 */

describe("SessionGoalList", () => {
  it("renders one row per goal", () => {
    const goals = [
      createMockGoal({ id: "g1", title: "Improve technical leadership" }),
      createMockGoal({ id: "g2", title: "Build public speaking confidence" }),
      createMockGoal({ id: "g3", title: "Develop delegation skills" }),
    ];
    const { container } = render(<SessionGoalList goals={goals} />);

    expect(screen.getByText("Improve technical leadership")).toBeInTheDocument();
    expect(screen.getByText("Build public speaking confidence")).toBeInTheDocument();
    expect(screen.getByText("Develop delegation skills")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-testid='session-goal-row']")).toHaveLength(3);
  });

  it("shows the default goal title when a goal has an empty title", () => {
    const goals = [createMockGoal({ id: "g1", title: "" })];
    render(<SessionGoalList goals={goals} />);
    expect(screen.getByText(DEFAULT_GOAL_TITLE)).toBeInTheDocument();
  });

  it("renders nothing by default when the goals list is empty", () => {
    const { container } = render(<SessionGoalList goals={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the provided emptyFallback when goals is empty", () => {
    render(
      <SessionGoalList
        goals={[]}
        emptyFallback={<p>No goals linked to this session</p>}
      />
    );
    expect(screen.getByText("No goals linked to this session")).toBeInTheDocument();
  });

  it("applies default class names to dot and text elements", () => {
    const goals = [createMockGoal({ id: "g1", title: "Some goal" })];
    const { container } = render(<SessionGoalList goals={goals} />);
    const dot = container.querySelector("[data-testid='session-goal-dot']");
    const text = container.querySelector("[data-testid='session-goal-text']");
    expect(dot?.className).toContain("bg-emerald-800/50");
    expect(text?.className).toContain("text-sm");
    expect(text?.className).toContain("text-muted-foreground");
  });

  it("honors class-name overrides", () => {
    const goals = [createMockGoal({ id: "g1", title: "Some goal" })];
    const { container } = render(
      <SessionGoalList
        goals={goals}
        dotClassName="bg-red-500"
        textClassName="text-xs text-foreground"
        gapClassName="gap-2"
      />
    );
    const dot = container.querySelector("[data-testid='session-goal-dot']");
    const text = container.querySelector("[data-testid='session-goal-text']");
    expect(dot?.className).toContain("bg-red-500");
    expect(dot?.className).not.toContain("bg-emerald-800/50");
    expect(text?.className).toContain("text-xs");
    expect(text?.className).toContain("text-foreground");
  });
});
