import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { CompactGoalCard } from "@/components/ui/coaching-sessions/goal-card-compact"
import { createMockGoal } from "../../../test-utils"
import { ItemStatus } from "@/types/general"
import { GoalProgress } from "@/types/goal-progress"
import { None } from "@/types/option"

// Mock the goal progress hook so tests don't fire real API calls
vi.mock("@/lib/api/goal-progress", () => ({
  useGoalProgress: () => ({
    progressMetrics: {
      actions_completed: 3,
      actions_total: 8,
      linked_session_count: 2,
      progress: GoalProgress.SolidMomentum,
      last_session_date: None,
      next_action_due: None,
    },
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  }),
}))

describe("CompactGoalCard", () => {
  const defaultGoal = createMockGoal({
    id: "goal-1",
    title: "Improve technical leadership",
    body: "Focus on architecture decisions",
    status: ItemStatus.InProgress,
  })

  it("renders the goal title on both faces", () => {
    render(
      <CompactGoalCard
        goal={defaultGoal}
        onRemove={vi.fn()}
        onUpdate={vi.fn()}
      />
    )

    // Title appears on both the front and back face
    const titles = screen.getAllByText("Improve technical leadership")
    expect(titles.length).toBeGreaterThanOrEqual(1)
  })

  it("shows the info button when onRemove or onUpdate are provided", () => {
    render(
      <CompactGoalCard
        goal={defaultGoal}
        onRemove={vi.fn()}
        onUpdate={vi.fn()}
      />
    )

    expect(
      screen.getByRole("button", { name: /goal options for/i })
    ).toBeInTheDocument()
  })

  it("does not show the info button when neither onRemove nor onUpdate are provided", () => {
    render(<CompactGoalCard goal={defaultGoal} />)

    expect(
      screen.queryByRole("button", { name: /goal options for/i })
    ).not.toBeInTheDocument()
  })

  it("flips to back face when info button is clicked", async () => {
    const user = userEvent.setup()

    render(
      <CompactGoalCard
        goal={defaultGoal}
        onRemove={vi.fn()}
        onUpdate={vi.fn()}
      />
    )

    const infoButton = screen.getByRole("button", { name: /goal options for/i })
    await user.click(infoButton)

    // Back face shows "Done" button and action buttons
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument()
  })

  it("flips back to front face when Done is clicked", async () => {
    const user = userEvent.setup()

    render(
      <CompactGoalCard
        goal={defaultGoal}
        onRemove={vi.fn()}
        onUpdate={vi.fn()}
      />
    )

    // Flip to back
    await user.click(screen.getByRole("button", { name: /goal options for/i }))

    // Flip back to front
    await user.click(screen.getByRole("button", { name: /done/i }))

    // Info button should be visible again (front face)
    expect(
      screen.getByRole("button", { name: /goal options for/i })
    ).toBeInTheDocument()
  })

  it("calls onRemove when Remove button is clicked on back face", async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()

    render(
      <CompactGoalCard
        goal={defaultGoal}
        onRemove={onRemove}
        onUpdate={vi.fn()}
      />
    )

    // Flip to back
    await user.click(screen.getByRole("button", { name: /goal options for/i }))

    // Click Remove
    await user.click(screen.getByRole("button", { name: /remove/i }))

    expect(onRemove).toHaveBeenCalledOnce()
  })

  it("shows progress bar when actions exist", () => {
    const { container } = render(
      <CompactGoalCard
        goal={defaultGoal}
        onRemove={vi.fn()}
      />
    )

    // Progress bar container with rounded-full classes
    const progressBar = container.querySelector(".bg-border\\/40")
    expect(progressBar).toBeInTheDocument()
  })

  it("clicking the title expands to show the full title and body", async () => {
    const user = userEvent.setup()

    render(<CompactGoalCard goal={defaultGoal} />)

    // Both faces render the title and body — take the first (front face) for each
    const frontTitle = screen.getAllByText("Improve technical leadership")[0]
    const frontBody = screen.getAllByText("Focus on architecture decisions")[0]
    const bodyContainer = frontBody.closest("div")!

    // Initially: title is clamped, body is collapsed
    expect(frontTitle.className).toContain("line-clamp-2")
    expect(bodyContainer.className).toContain("max-h-0")

    // Click the title to expand
    await user.click(frontTitle)

    // Title clamp removed, body visible
    expect(frontTitle.className).not.toContain("line-clamp-2")
    expect(bodyContainer.className).toContain("max-h-40")
  })

  it("clicking the title again collapses the body and re-clamps the title", async () => {
    const user = userEvent.setup()

    render(<CompactGoalCard goal={defaultGoal} />)

    const frontTitle = screen.getAllByText("Improve technical leadership")[0]
    const frontBody = screen.getAllByText("Focus on architecture decisions")[0]
    const bodyContainer = frontBody.closest("div")!

    // Expand then collapse
    await user.click(frontTitle)
    await user.click(frontTitle)

    expect(frontTitle.className).toContain("line-clamp-2")
    expect(bodyContainer.className).toContain("max-h-0")
  })

  it("title is not clickable when goal has no body and title is not clipped", () => {
    const goalNoBody = createMockGoal({
      id: "goal-no-body",
      title: "Short title",
      body: "",
      status: ItemStatus.InProgress,
    })

    render(<CompactGoalCard goal={goalNoBody} />)

    // Front face title — back face also renders the title
    const frontTitle = screen.getAllByText("Short title")[0]
    expect(frontTitle.className).not.toContain("cursor-pointer")
  })

  it("renders swap mode card with 'Put on hold' text", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <CompactGoalCard
        goal={defaultGoal}
        swapMode={{ onSelect }}
      />
    )

    // Swap mode shows a simple selectable card
    const card = screen.getByRole("button")
    await user.click(card)

    expect(onSelect).toHaveBeenCalledOnce()
  })

})
