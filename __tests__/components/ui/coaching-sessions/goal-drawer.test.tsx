import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { GoalDrawer } from "@/components/ui/coaching-sessions/goal-drawer"
import { createMockGoal } from "../../../test-utils"
import { ItemStatus } from "@/types/general"
import { GoalProgress } from "@/types/goal-progress"
import { None } from "@/types/option"

// Mock the API hooks
const mockRefreshSession = vi.fn()
const mockRefreshAll = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()

vi.mock("@/lib/api/goals", () => ({
  useGoalsBySession: vi.fn(),
  useGoalList: vi.fn(),
  useGoalMutation: vi.fn(() => ({
    create: mockCreate,
    update: mockUpdate,
    delete: vi.fn(),
    createNested: vi.fn(),
    deleteNested: vi.fn(),
  })),
  GoalApi: {
    linkToSession: vi.fn(),
    unlinkFromSession: vi.fn(),
  },
}))

vi.mock("@/lib/api/goal-progress", () => ({
  useGoalProgress: vi.fn(() => ({
    progressMetrics: {
      actions_completed: 3,
      actions_total: 8,
      linked_session_count: 2,
      progress: GoalProgress.SolidMomentum,
      last_session_date: None,
      next_action_due: None,
    },
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  })),
}))

vi.mock("@/site.config", () => ({
  siteConfig: {
    env: {
      backendServiceURL: "http://localhost:3000",
    },
  },
}))

// Import after mocks
import { useGoalsBySession, useGoalList, GoalApi } from "@/lib/api/goals"

const goal1 = createMockGoal({
  id: "goal-1",
  title: "Improve technical leadership",
  status: ItemStatus.InProgress,
})

const goal2 = createMockGoal({
  id: "goal-2",
  title: "Build public speaking confidence",
  status: ItemStatus.InProgress,
})

function setupMocks({
  sessionGoals = [goal1],
  allGoals = [goal1, goal2],
}: {
  sessionGoals?: ReturnType<typeof createMockGoal>[]
  allGoals?: ReturnType<typeof createMockGoal>[]
} = {}) {
  vi.mocked(useGoalsBySession).mockReturnValue({
    goals: sessionGoals,
    isLoading: false,
    isError: false,
    refresh: mockRefreshSession,
  })

  vi.mocked(useGoalList).mockReturnValue({
    goals: allGoals,
    isLoading: false,
    isError: false,
    refresh: mockRefreshAll,
  })
}

// Both desktop and mobile layouts render in jsdom (no CSS media queries).
// Use getAllBy* and take the first match where needed.

describe("GoalDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders 'Goals' label in both layouts", () => {
    setupMocks()
    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Both desktop and mobile render "Goals"
    const labels = screen.getAllByText("Goals")
    expect(labels.length).toBeGreaterThanOrEqual(1)
  })

  it("shows goal title for linked goals", () => {
    setupMocks()
    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Goal title appears in both desktop (CompactGoalCard) and mobile (GoalChip)
    const titles = screen.getAllByText("Improve technical leadership")
    expect(titles.length).toBeGreaterThanOrEqual(1)
  })

  it("shows 'No goals set' when empty", () => {
    setupMocks({ sessionGoals: [] })
    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    const messages = screen.getAllByText(/no goals set for this session/i)
    expect(messages.length).toBeGreaterThanOrEqual(1)
  })

  it("shows counter with linked/max format", () => {
    setupMocks()
    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    const counters = screen.getAllByText("1/3")
    expect(counters.length).toBeGreaterThanOrEqual(1)
  })

  it("expands mobile view on chevron click to show goal progress cards", async () => {
    const user = userEvent.setup()
    setupMocks()
    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // The expand button only exists in the mobile layout
    const expandButton = screen.getByRole("button", { name: /expand/i })
    await user.click(expandButton)

    // Should now show the progress card content
    expect(screen.getByText(/actions remaining/i)).toBeInTheDocument()
  })

  it("shows 'Set goal' button from GoalPicker", () => {
    setupMocks()
    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Both layouts render a GoalPicker with "Set goal"
    const buttons = screen.getAllByRole("button", { name: /set goal/i })
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it("does not show counter when no goals linked", () => {
    setupMocks({ sessionGoals: [] })
    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    expect(screen.queryByText(/\/3/)).not.toBeInTheDocument()
  })

  it("linking an OnHold goal transitions it to InProgress", async () => {
    const user = userEvent.setup()
    const onHoldGoal = createMockGoal({
      id: "goal-hold",
      title: "Paused goal",
      status: ItemStatus.OnHold,
    })
    const mockOkResult = {
      isOk: () => true,
      isErr: () => false,
      match: (ok: () => void) => ok(),
    }
    vi.mocked(GoalApi.linkToSession).mockResolvedValue(mockOkResult as any)
    mockUpdate.mockResolvedValue({ ...onHoldGoal, status: ItemStatus.InProgress })

    setupMocks({
      sessionGoals: [],
      allGoals: [onHoldGoal],
    })

    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Open picker (use first "Set goal" button) and click the on-hold goal
    const setGoalButtons = screen.getAllByRole("button", { name: /set goal/i })
    await user.click(setGoalButtons[0])
    await user.click(screen.getByText("Paused goal"))

    // Should transition status to InProgress before linking
    expect(mockUpdate).toHaveBeenCalledWith(
      "goal-hold",
      expect.objectContaining({ status: ItemStatus.InProgress })
    )

    // Then should link to session
    expect(GoalApi.linkToSession).toHaveBeenCalledWith(
      "session-1",
      "goal-hold"
    )
  })

  it("linking a NotStarted goal does not change its status", async () => {
    const user = userEvent.setup()
    const notStartedGoal = createMockGoal({
      id: "goal-ns",
      title: "Fresh goal",
      status: ItemStatus.NotStarted,
    })
    const mockOkResult = {
      isOk: () => true,
      isErr: () => false,
      match: (ok: () => void) => ok(),
    }
    vi.mocked(GoalApi.linkToSession).mockResolvedValue(mockOkResult as any)

    setupMocks({
      sessionGoals: [],
      allGoals: [notStartedGoal],
    })

    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Open picker and click the goal
    const setGoalButtons = screen.getAllByRole("button", { name: /set goal/i })
    await user.click(setGoalButtons[0])
    await user.click(screen.getByText("Fresh goal"))

    // Should NOT call updateGoal — NotStarted stays as-is
    expect(mockUpdate).not.toHaveBeenCalled()

    // Should link to session
    expect(GoalApi.linkToSession).toHaveBeenCalledWith(
      "session-1",
      "goal-ns"
    )
  })

  it("remove only removes join table row, does not change goal status", async () => {
    const user = userEvent.setup()
    const mockUnlinkResult = { isOk: () => true, isErr: () => false, match: (ok: () => void) => ok() }
    vi.mocked(GoalApi.unlinkFromSession).mockResolvedValue(mockUnlinkResult as any)
    setupMocks()

    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Click the first Remove button (desktop CompactGoalCard or mobile GoalChip)
    const removeButtons = screen.getAllByRole("button", {
      name: /remove improve technical leadership/i,
    })
    await user.click(removeButtons[0])

    // Should call unlinkFromSession with the correct IDs
    expect(GoalApi.unlinkFromSession).toHaveBeenCalledWith(
      "session-1",
      "goal-1"
    )

    // Should NOT call updateGoal — status must remain unchanged
    expect(mockUpdate).not.toHaveBeenCalled()

    // Should refresh session goals after successful unlink
    expect(mockRefreshSession).toHaveBeenCalled()
  })

  it("swap changes goal status to OnHold before unlinking", async () => {
    const user = userEvent.setup()
    const goal3 = createMockGoal({
      id: "goal-3",
      title: "Develop delegation skills",
      status: ItemStatus.InProgress,
    })
    const mockOkResult = { isOk: () => true, isErr: () => false, match: (ok: () => void) => ok() }
    vi.mocked(GoalApi.unlinkFromSession).mockResolvedValue(mockOkResult as any)
    vi.mocked(GoalApi.linkToSession).mockResolvedValue(mockOkResult as any)
    mockUpdate.mockResolvedValue(goal1)
    mockCreate.mockResolvedValue(createMockGoal({ title: "Replacement goal" }))

    setupMocks({
      sessionGoals: [goal1, goal2, goal3],
      allGoals: [goal1, goal2, goal3],
    })

    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // At limit (3/3) — open picker and go to create flow
    const setGoalButtons = screen.getAllByRole("button", { name: /set goal/i })
    await user.click(setGoalButtons[0])
    await user.click(screen.getByRole("button", { name: /create new goal/i }))

    const textarea = screen.getByPlaceholderText(/i want to/i)
    await user.type(textarea, "Replacement goal")

    // Select swap target in create panel — these are the linked goals
    // shown inside the create form's swap selector
    const swapTargets = screen.getAllByText("Improve technical leadership")
    await user.click(swapTargets[swapTargets.length - 1])

    await user.click(screen.getByRole("button", { name: /create & swap/i }))

    // Should call updateGoal to change status to OnHold
    expect(mockUpdate).toHaveBeenCalledWith(
      "goal-1",
      expect.objectContaining({ status: ItemStatus.OnHold })
    )

    // Should call unlinkFromSession for the swapped goal
    expect(GoalApi.unlinkFromSession).toHaveBeenCalledWith(
      "session-1",
      "goal-1"
    )

    // Should create the new goal
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Replacement goal" })
    )
  })
})
