import { render, screen } from "@testing-library/react"
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

describe("GoalDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders collapsed bar with 'Goals' label", () => {
    setupMocks()
    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    expect(screen.getByText("Goals")).toBeInTheDocument()
  })

  it("shows chips for linked goals", () => {
    setupMocks()
    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    expect(screen.getByText("Improve technical leadership")).toBeInTheDocument()
  })

  it("shows 'No goals linked' when empty", () => {
    setupMocks({ sessionGoals: [] })
    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    expect(
      screen.getByText(/no goals linked to this session/i)
    ).toBeInTheDocument()
  })

  it("shows counter with linked/max format", () => {
    setupMocks()
    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    expect(screen.getByText("1/3")).toBeInTheDocument()
  })

  it("expands on chevron click to show goal progress cards", async () => {
    const user = userEvent.setup()
    setupMocks()
    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Click the expand button
    const expandButton = screen.getByRole("button", { name: /expand/i })
    await user.click(expandButton)

    // Should now show the progress card content
    expect(screen.getByText(/actions remaining/i)).toBeInTheDocument()
  })

  it("shows 'Link goal' button from GoalPicker", () => {
    setupMocks()
    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    expect(
      screen.getByRole("button", { name: /link goal/i })
    ).toBeInTheDocument()
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

  it("unlink only removes join table row, does not change goal status", async () => {
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

    // Click the X button on the goal chip
    const unlinkButton = screen.getByRole("button", {
      name: /unlink improve technical leadership/i,
    })
    await user.click(unlinkButton)

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
    await user.click(screen.getByRole("button", { name: /link goal/i }))
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
