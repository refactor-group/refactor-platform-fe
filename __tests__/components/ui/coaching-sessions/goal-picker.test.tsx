import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { GoalPicker } from "@/components/ui/coaching-sessions/goal-picker"
import { createMockGoal } from "../../../test-utils"
import { ItemStatus } from "@/types/general"

const activeGoal1 = createMockGoal({
  id: "goal-1",
  title: "Build public speaking confidence",
  status: ItemStatus.InProgress,
})

const activeGoal2 = createMockGoal({
  id: "goal-2",
  title: "Develop delegation skills",
  status: ItemStatus.InProgress,
})

const activeGoal3 = createMockGoal({
  id: "goal-3",
  title: "Improve technical leadership",
  status: ItemStatus.InProgress,
})

const onHoldGoal = createMockGoal({
  id: "goal-hold",
  title: "Strengthen cross-team collaboration",
  status: ItemStatus.WontDo,
})

const allGoals = [activeGoal1, activeGoal2, activeGoal3, onHoldGoal]

describe("GoalPicker", () => {
  const defaultProps = {
    linkedGoalIds: new Set(["goal-1"]),
    allGoals,
    linkedGoals: [activeGoal1],
    onLink: vi.fn(),
    onCreateAndLink: vi.fn(),
    onCreateAndSwap: vi.fn(),
    atLimit: false,
  }

  it("renders the 'Link goal' trigger button", () => {
    render(<GoalPicker {...defaultProps} />)

    expect(screen.getByRole("button", { name: /link goal/i })).toBeInTheDocument()
  })

  it("opens popover on click and shows search input", async () => {
    const user = userEvent.setup()
    render(<GoalPicker {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))

    expect(screen.getByPlaceholderText(/search goals/i)).toBeInTheDocument()
  })

  it("lists available (unlinked) active goals sorted alphabetically", async () => {
    const user = userEvent.setup()
    render(<GoalPicker {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))

    // goal-2 "Develop delegation skills" and goal-3 "Improve technical leadership" are unlinked
    // They should appear alphabetically: Develop... before Improve...
    const items = screen.getAllByRole("option")
    const activeGoalTexts = items
      .map((item) => item.textContent)
      .filter(
        (text) =>
          text?.includes("Develop") || text?.includes("Improve technical")
      )

    expect(activeGoalTexts).toHaveLength(2)
    // "Develop delegation skills" should come before "Improve technical leadership"
    const developIndex = items.findIndex((item) =>
      item.textContent?.includes("Develop")
    )
    const improveIndex = items.findIndex((item) =>
      item.textContent?.includes("Improve technical")
    )
    expect(developIndex).toBeLessThan(improveIndex)
  })

  it("lists on-hold goals in a separate group", async () => {
    const user = userEvent.setup()
    render(<GoalPicker {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))

    expect(
      screen.getByText("Strengthen cross-team collaboration")
    ).toBeInTheDocument()
  })

  it("calls onLink when a goal is selected (under limit)", async () => {
    const user = userEvent.setup()
    const onLink = vi.fn()
    render(<GoalPicker {...defaultProps} onLink={onLink} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))
    await user.click(screen.getByText("Develop delegation skills"))

    expect(onLink).toHaveBeenCalledWith("goal-2")
  })

  it("disables goal items when atLimit is true", async () => {
    const user = userEvent.setup()
    const onLink = vi.fn()
    render(<GoalPicker {...defaultProps} atLimit={true} onLink={onLink} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))
    await user.click(screen.getByText("Develop delegation skills"))

    expect(onLink).not.toHaveBeenCalled()
  })

  it("shows 'Create new goal' button that expands create panel", async () => {
    const user = userEvent.setup()
    render(<GoalPicker {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))

    const createButton = screen.getByRole("button", {
      name: /create new goal/i,
    })
    expect(createButton).toBeInTheDocument()

    await user.click(createButton)

    expect(screen.getByText("New goal")).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(/i want to/i)
    ).toBeInTheDocument()
  })

  it("calls onCreateAndLink on submit (under limit)", async () => {
    const user = userEvent.setup()
    const onCreateAndLink = vi.fn()
    render(<GoalPicker {...defaultProps} onCreateAndLink={onCreateAndLink} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))
    await user.click(
      screen.getByRole("button", { name: /create new goal/i })
    )

    const textarea = screen.getByPlaceholderText(/i want to/i)
    await user.type(textarea, "Master conflict resolution")
    await user.click(screen.getByRole("button", { name: /create & link/i }))

    expect(onCreateAndLink).toHaveBeenCalledWith("Master conflict resolution")
  })

  it("shows context message and swap selector when at limit in create view", async () => {
    const user = userEvent.setup()
    render(
      <GoalPicker
        {...defaultProps}
        linkedGoalIds={new Set(["goal-1", "goal-2", "goal-3"])}
        linkedGoals={[activeGoal1, activeGoal2, activeGoal3]}
        atLimit={true}
      />
    )

    await user.click(screen.getByRole("button", { name: /link goal/i }))
    await user.click(
      screen.getByRole("button", { name: /create new goal/i })
    )

    expect(
      screen.getByText(/goal slots are in use/i)
    ).toBeInTheDocument()
  })

  it("calls onCreateAndSwap on submit when at limit with swap selected", async () => {
    const user = userEvent.setup()
    const onCreateAndSwap = vi.fn()
    render(
      <GoalPicker
        {...defaultProps}
        linkedGoalIds={new Set(["goal-1", "goal-2", "goal-3"])}
        linkedGoals={[activeGoal1, activeGoal2, activeGoal3]}
        atLimit={true}
        onCreateAndSwap={onCreateAndSwap}
      />
    )

    await user.click(screen.getByRole("button", { name: /link goal/i }))
    await user.click(
      screen.getByRole("button", { name: /create new goal/i })
    )

    const textarea = screen.getByPlaceholderText(/i want to/i)
    await user.type(textarea, "New important goal")

    // Select a goal to swap
    await user.click(
      screen.getByText("Build public speaking confidence")
    )

    await user.click(
      screen.getByRole("button", { name: /create & swap/i })
    )

    expect(onCreateAndSwap).toHaveBeenCalledWith(
      "New important goal",
      "goal-1"
    )
  })

  it("disables submit until title entered", async () => {
    const user = userEvent.setup()
    render(<GoalPicker {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))
    await user.click(
      screen.getByRole("button", { name: /create new goal/i })
    )

    const submitButton = screen.getByRole("button", { name: /create & link/i })
    expect(submitButton).toBeDisabled()
  })

  it("'Back to search' resets to search view", async () => {
    const user = userEvent.setup()
    render(<GoalPicker {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))
    await user.click(
      screen.getByRole("button", { name: /create new goal/i })
    )

    expect(screen.getByText("New goal")).toBeInTheDocument()

    await user.click(screen.getByText(/back to search/i))

    expect(screen.queryByText("New goal")).not.toBeInTheDocument()
  })
})
