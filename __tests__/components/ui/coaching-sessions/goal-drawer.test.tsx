import { render, screen, waitFor } from "@testing-library/react"
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

    const expandButton = screen.getByRole("button", { name: /expand/i })
    await user.click(expandButton)

    expect(screen.getByText(/actions remaining/i)).toBeInTheDocument()
  })

  it("shows 'Add goal' button", () => {
    setupMocks()
    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    const addButtons = screen.getAllByRole("button", { name: /add goal/i })
    expect(addButtons.length).toBeGreaterThanOrEqual(1)
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

    // Click "Add goal" to enter browsing, then click the on-hold goal
    const addGoalButtons = screen.getAllByRole("button", { name: /add goal/i })
    await user.click(addGoalButtons[0])
    await user.click(screen.getByText("Paused goal"))

    expect(mockUpdate).toHaveBeenCalledWith(
      "goal-hold",
      expect.objectContaining({ status: ItemStatus.InProgress })
    )

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

    const addGoalButtons = screen.getAllByRole("button", { name: /add goal/i })
    await user.click(addGoalButtons[0])
    await user.click(screen.getByText("Fresh goal"))

    expect(mockUpdate).not.toHaveBeenCalled()

    expect(GoalApi.linkToSession).toHaveBeenCalledWith(
      "session-1",
      "goal-ns"
    )
  })

  it("unlink auto-holds InProgress goal on current session", async () => {
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

    const removeButtons = screen.getAllByRole("button", {
      name: /remove improve technical leadership/i,
    })
    await user.click(removeButtons[0])

    expect(GoalApi.unlinkFromSession).toHaveBeenCalledWith(
      "session-1",
      "goal-1"
    )

    // Auto-hold: unlinking from a non-readOnly session puts the goal on hold
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        "goal-1",
        expect.objectContaining({ status: ItemStatus.OnHold })
      )
    })
    expect(mockRefreshSession).toHaveBeenCalled()
  })

  it("unlink does not change goal status on past (readOnly) session", async () => {
    const mockUnlinkResult = { isOk: () => true, isErr: () => false, match: (ok: () => void) => ok() }
    vi.mocked(GoalApi.unlinkFromSession).mockResolvedValue(mockUnlinkResult as any)
    setupMocks()

    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
        readOnly
      />
    )

    // readOnly hides the remove buttons, so unlink cannot be triggered from UI
    const removeButtons = screen.queryAllByRole("button", {
      name: /remove improve technical leadership/i,
    })
    expect(removeButtons).toHaveLength(0)
  })

  it("inline create form creates a new goal", async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue(createMockGoal({ title: "New goal" }))

    setupMocks({ sessionGoals: [] })

    render(
      <GoalDrawer
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Click "Add goal" to browse, then "Create new" to reveal inline form
    const addGoalButtons = screen.getAllByRole("button", { name: /add goal/i })
    await user.click(addGoalButtons[0])
    const createNewButtons = screen.getAllByRole("button", { name: /create new/i })
    await user.click(createNewButtons[0])

    // Type into the input and submit
    const input = screen.getByPlaceholderText(/what do you want to achieve/i)
    await user.type(input, "New goal{Enter}")

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New goal" })
    )
  })

  it("swap flow: select goal to hold, then create replacement", async () => {
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

    // Step 1: At limit (3/3) — click "Add goal" enters swap-selection mode
    const addGoalButtons = screen.getAllByRole("button", { name: /add goal/i })
    await user.click(addGoalButtons[0])

    // Should show "Which goal should be put on hold?" prompt
    expect(screen.getAllByText(/put on hold/i).length).toBeGreaterThanOrEqual(1)

    // Step 2: Click first goal card to select it as swap target
    // In swap mode, cards become buttons with "Put on hold" text
    const putOnHoldButtons = screen.getAllByRole("button", {
      name: /improve technical leadership/i,
    })
    await user.click(putOnHoldButtons[0])

    // Step 3: Now in browsing state — click "Create new" to enter creating state
    const createNewButtons = screen.getAllByRole("button", { name: /create new/i })
    await user.click(createNewButtons[0])

    // Step 4: Fill in the create form and submit
    const input = screen.getByPlaceholderText(/what do you want to achieve/i)
    await user.type(input, "Replacement goal")

    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        "goal-1",
        expect.objectContaining({ status: ItemStatus.OnHold })
      )
    })

    expect(GoalApi.unlinkFromSession).toHaveBeenCalledWith(
      "session-1",
      "goal-1"
    )

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Replacement goal" })
    )
  })
})
