import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
        onRemove={vi.fn()}
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
        onRemove={vi.fn()}
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
        onRemove={vi.fn()}
      />
    )

    // No progress ring SVG should be present (the X icon SVG is still there)
    expect(container.querySelector('svg[viewBox="0 0 16 16"]')).not.toBeInTheDocument()
  })

  it("calls onRemove when unlink button is clicked", async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()

    render(
      <GoalChip
        goal={defaultGoal}
        actionsCompleted={3}
        actionsTotal={8}
        onRemove={onRemove}
      />
    )

    const unlinkButton = screen.getByRole("button", {
      name: /unlink improve technical leadership/i,
    })
    await user.click(unlinkButton)

    expect(onRemove).toHaveBeenCalledOnce()
  })

  it("has accessible unlink button with goal title in aria-label", () => {
    render(
      <GoalChip
        goal={defaultGoal}
        actionsCompleted={0}
        actionsTotal={0}
        onRemove={vi.fn()}
      />
    )

    expect(
      screen.getByRole("button", {
        name: /unlink improve technical leadership/i,
      })
    ).toBeInTheDocument()
  })
})
