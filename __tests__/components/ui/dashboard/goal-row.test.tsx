import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { GoalRow } from "@/components/ui/dashboard/goal-row";

describe("GoalRow", () => {
  const defaultProps = {
    title: "Improve technical leadership",
    actionsCompleted: 6,
    actionsTotal: 8,
    linkedSessionCount: 3,
  };

  it("renders the goal title", () => {
    render(<GoalRow {...defaultProps} />);
    expect(
      screen.getByText("Improve technical leadership")
    ).toBeInTheDocument();
  });

  it("renders action counts in 'X/Y actions' format", () => {
    render(<GoalRow {...defaultProps} />);
    expect(screen.getByText(/6\/8 actions/)).toBeInTheDocument();
  });

  it("renders linked session count with plural 'sessions'", () => {
    render(<GoalRow {...defaultProps} />);
    expect(screen.getByText(/3 sessions/)).toBeInTheDocument();
  });

  it("uses singular 'session' when count is 1", () => {
    render(<GoalRow {...defaultProps} linkedSessionCount={1} />);
    expect(screen.getByText(/1 session\b/)).toBeInTheDocument();
  });

  it("renders the computed percentage", () => {
    render(<GoalRow {...defaultProps} />);
    // 6/8 = 75%
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("renders 0% when actionsTotal is 0", () => {
    render(<GoalRow {...defaultProps} actionsCompleted={0} actionsTotal={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders 100% when all actions are completed", () => {
    render(
      <GoalRow {...defaultProps} actionsCompleted={5} actionsTotal={5} />
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
