import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { GoalChip } from "@/components/ui/coaching-sessions/goal-chip"
import { createMockGoal } from "../../../test-utils"
import { ItemStatus } from "@/types/general"

describe("GoalChip", () => {
  const defaultGoal = createMockGoal({
    id: "goal-1",
    title: "Improve technical leadership",
    status: ItemStatus.InProgress,
  })

  it("renders the goal title", () => {
    render(
      <GoalChip
        goal={defaultGoal}
        actionsCompleted={3}
        actionsTotal={8}
      />
    )

    expect(screen.getByText("Improve technical leadership")).toBeInTheDocument()
  })

  it("shows mini progress ring when actionsTotal > 0", () => {
    const { container } = render(
      <GoalChip
        goal={defaultGoal}
        actionsCompleted={3}
        actionsTotal={8}
      />
    )

    // The progress ring SVG has a viewBox="0 0 16 16"
    expect(container.querySelector('svg[viewBox="0 0 16 16"]')).toBeInTheDocument()
  })

  it("hides progress ring when actionsTotal is 0", () => {
    const { container } = render(
      <GoalChip
        goal={defaultGoal}
        actionsCompleted={0}
        actionsTotal={0}
      />
    )

    expect(container.querySelector('svg[viewBox="0 0 16 16"]')).not.toBeInTheDocument()
  })

  it("does not render any interactive buttons", () => {
    render(
      <GoalChip
        goal={defaultGoal}
        actionsCompleted={3}
        actionsTotal={8}
      />
    )

    // GoalChip is display-only — no buttons for remove or other actions
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
