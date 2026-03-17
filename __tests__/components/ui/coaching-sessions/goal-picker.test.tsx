import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { GoalPicker } from "@/components/ui/coaching-sessions/goal-picker"
import { createMockGoal } from "../../../test-utils"
import { ItemStatus } from "@/types/general"
import { DateTime } from "ts-luxon"

const now = DateTime.now()

// NotStarted goals — varied created_at for recency grouping
const notStartedGoal1 = createMockGoal({
  id: "goal-ns-1",
  title: "Build public speaking confidence",
  status: ItemStatus.NotStarted,
  created_at: now.minus({ days: 1 }),
})

const notStartedGoal2 = createMockGoal({
  id: "goal-ns-2",
  title: "Develop delegation skills",
  status: ItemStatus.NotStarted,
  created_at: now.minus({ days: 2 }),
})

const notStartedGoal3 = createMockGoal({
  id: "goal-ns-3",
  title: "Improve technical leadership",
  status: ItemStatus.NotStarted,
  created_at: now.minus({ days: 3 }),
})

const notStartedGoal4 = createMockGoal({
  id: "goal-ns-4",
  title: "Master conflict resolution",
  status: ItemStatus.NotStarted,
  created_at: now.minus({ days: 10 }),
})

const notStartedGoal5 = createMockGoal({
  id: "goal-ns-5",
  title: "Strengthen stakeholder communication",
  status: ItemStatus.NotStarted,
  created_at: now.minus({ days: 20 }),
})

// InProgress goals (should NOT appear in the available list)
const inProgressGoal = createMockGoal({
  id: "goal-ip-1",
  title: "Active goal already in progress",
  status: ItemStatus.InProgress,
})

const onHoldGoal = createMockGoal({
  id: "goal-hold",
  title: "Strengthen cross-team collaboration",
  status: ItemStatus.WontDo,
})

const allGoals = [
  notStartedGoal1,
  notStartedGoal2,
  notStartedGoal3,
  notStartedGoal4,
  notStartedGoal5,
  inProgressGoal,
  onHoldGoal,
]

describe("GoalPicker", () => {
  const defaultProps = {
    linkedGoalIds: new Set(["goal-ip-1"]),
    allGoals,
    linkedGoals: [inProgressGoal],
    onLink: vi.fn(),
    onCreateAndLink: vi.fn(),
    onCreateAndSwap: vi.fn(),
    atLimit: false,
  }

  it("renders the 'Link goal' trigger button", () => {
    render(<GoalPicker {...defaultProps} />)

    expect(
      screen.getByRole("button", { name: /link goal/i })
    ).toBeInTheDocument()
  })

  it("opens popover on click and shows search input", async () => {
    const user = userEvent.setup()
    render(<GoalPicker {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))

    expect(
      screen.getByPlaceholderText(/search goals/i)
    ).toBeInTheDocument()
  })

  it("shows NotStarted goals, not InProgress goals", async () => {
    const user = userEvent.setup()
    render(<GoalPicker {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))

    expect(
      screen.getByText("Build public speaking confidence")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Active goal already in progress")
    ).not.toBeInTheDocument()
  })

  it("shows the 3 most recent goals in 'Recent' group", async () => {
    const user = userEvent.setup()
    render(<GoalPicker {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))

    expect(screen.getByText("Recent")).toBeInTheDocument()
    expect(
      screen.getByText("Build public speaking confidence")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Develop delegation skills")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Improve technical leadership")
    ).toBeInTheDocument()
  })

  it("collapses older goals behind a 'Show more' toggle", async () => {
    const user = userEvent.setup()
    render(<GoalPicker {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))

    // Older goals should not be visible initially
    expect(
      screen.queryByText("Master conflict resolution")
    ).not.toBeInTheDocument()

    // "Show N more" button
    const showMoreButton = screen.getByRole("button", {
      name: /show 2 more/i,
    })
    expect(showMoreButton).toBeInTheDocument()

    await user.click(showMoreButton)

    expect(
      screen.getByText("Master conflict resolution")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Strengthen stakeholder communication")
    ).toBeInTheDocument()
  })

  it("lists on-hold goals in a separate group", async () => {
    const user = userEvent.setup()
    render(<GoalPicker {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))

    expect(
      screen.getByText("Strengthen cross-team collaboration")
    ).toBeInTheDocument()
  })

  it("calls onLink when a goal is clicked", async () => {
    const user = userEvent.setup()
    const onLink = vi.fn()
    render(<GoalPicker {...defaultProps} onLink={onLink} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))
    await user.click(screen.getByText("Develop delegation skills"))

    expect(onLink).toHaveBeenCalledWith("goal-ns-2")
  })

  it("allows selecting goals even when atLimit is true (backend enforces)", async () => {
    const user = userEvent.setup()
    const onLink = vi.fn()
    render(<GoalPicker {...defaultProps} atLimit={true} onLink={onLink} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))
    await user.click(screen.getByText("Develop delegation skills"))

    expect(onLink).toHaveBeenCalledWith("goal-ns-2")
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
    render(
      <GoalPicker {...defaultProps} onCreateAndLink={onCreateAndLink} />
    )

    await user.click(screen.getByRole("button", { name: /link goal/i }))
    await user.click(
      screen.getByRole("button", { name: /create new goal/i })
    )

    const textarea = screen.getByPlaceholderText(/i want to/i)
    await user.type(textarea, "New goal from test")
    await user.click(
      screen.getByRole("button", { name: /create & link/i })
    )

    expect(onCreateAndLink).toHaveBeenCalledWith("New goal from test")
  })

  it("shows context message and swap selector when at limit in create view", async () => {
    const user = userEvent.setup()
    render(
      <GoalPicker
        {...defaultProps}
        linkedGoalIds={
          new Set(["goal-ip-1", "goal-ns-1", "goal-ns-2"])
        }
        linkedGoals={[inProgressGoal, notStartedGoal1, notStartedGoal2]}
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
        linkedGoalIds={
          new Set(["goal-ip-1", "goal-ns-1", "goal-ns-2"])
        }
        linkedGoals={[inProgressGoal, notStartedGoal1, notStartedGoal2]}
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

    await user.click(
      screen.getByText("Active goal already in progress")
    )

    await user.click(
      screen.getByRole("button", { name: /create & swap/i })
    )

    expect(onCreateAndSwap).toHaveBeenCalledWith(
      "New important goal",
      "goal-ip-1"
    )
  })

  it("disables submit until title entered", async () => {
    const user = userEvent.setup()
    render(<GoalPicker {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))
    await user.click(
      screen.getByRole("button", { name: /create new goal/i })
    )

    const submitButton = screen.getByRole("button", {
      name: /create & link/i,
    })
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

  it("does not show 'Show more' when 3 or fewer NotStarted goals", async () => {
    const user = userEvent.setup()
    const fewGoals = [
      notStartedGoal1,
      notStartedGoal2,
      notStartedGoal3,
      onHoldGoal,
    ]
    render(<GoalPicker {...defaultProps} allGoals={fewGoals} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))

    expect(
      screen.queryByRole("button", { name: /show.*more/i })
    ).not.toBeInTheDocument()
  })

  it("filters goals by search query", async () => {
    const user = userEvent.setup()
    render(<GoalPicker {...defaultProps} />)

    await user.click(screen.getByRole("button", { name: /link goal/i }))

    const searchInput = screen.getByPlaceholderText(/search goals/i)
    await user.type(searchInput, "delegation")

    expect(
      screen.getByText("Develop delegation skills")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Build public speaking confidence")
    ).not.toBeInTheDocument()
  })
})
