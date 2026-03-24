import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { GoalPanel } from "@/components/ui/coaching-sessions/goal-panel"
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

const { mockSonnerToast } = vi.hoisted(() => {
  const mockSonnerToast = vi.fn()
  return { mockSonnerToast }
})
vi.mock("sonner", () => ({
  toast: Object.assign(mockSonnerToast, {
    error: vi.fn(),
  }),
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

describe("GoalPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders 'Goals' label in both layouts", () => {
    setupMocks()
    render(
      <GoalPanel
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
      <GoalPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    const titles = screen.getAllByText("Improve technical leadership")
    expect(titles.length).toBeGreaterThanOrEqual(1)
  })

  it("shows 'No goals added yet' when empty", () => {
    setupMocks({ sessionGoals: [] })
    render(
      <GoalPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    const messages = screen.getAllByText(/no goals added yet/i)
    expect(messages.length).toBeGreaterThanOrEqual(1)
  })

  it("shows counter with linked/max format", () => {
    setupMocks()
    render(
      <GoalPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    const counters = screen.getAllByText("1/3")
    expect(counters.length).toBeGreaterThanOrEqual(1)
  })

  it("expands mobile view on chevron click to show compact goal cards", async () => {
    const user = userEvent.setup()
    setupMocks()
    render(
      <GoalPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    const expandButton = screen.getByRole("button", { name: /expand/i })
    await user.click(expandButton)

    // Expanded view shows compact goal cards with info (flip) buttons
    const infoButtons = screen.getAllByRole("button", {
      name: /goal options for/i,
    })
    expect(infoButtons.length).toBeGreaterThanOrEqual(1)
  })

  it("shows 'Add goal' button", () => {
    setupMocks()
    render(
      <GoalPanel
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
      <GoalPanel
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
      <GoalPanel
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
      <GoalPanel
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
      <GoalPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Flip the card to reveal back-face actions
    const infoButtons = screen.getAllByRole("button", {
      name: /goal options for/i,
    })
    await user.click(infoButtons[0])

    // Click Remove on the back face
    const removeButton = screen.getByRole("button", { name: /remove/i })
    await user.click(removeButton)

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

    // Should show undo toast via sonner
    expect(mockSonnerToast).toHaveBeenCalledWith(
      expect.stringContaining("removed from session"),
      expect.objectContaining({
        action: expect.objectContaining({ label: "Undo" }),
      })
    )
  })

  it("undo remove re-links the goal and restores InProgress status", async () => {
    const user = userEvent.setup()
    const mockUnlinkResult = { isOk: () => true, isErr: () => false, match: (ok: () => void) => ok() }
    const mockRelinkResult = { isOk: () => true, isErr: () => false }
    vi.mocked(GoalApi.unlinkFromSession).mockResolvedValue(mockUnlinkResult as any)
    vi.mocked(GoalApi.linkToSession).mockResolvedValue(mockRelinkResult as any)
    mockUpdate.mockResolvedValue(goal1)
    setupMocks()

    render(
      <GoalPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Flip and remove
    const infoButtons = screen.getAllByRole("button", { name: /goal options for/i })
    await user.click(infoButtons[0])
    await user.click(screen.getByRole("button", { name: /remove/i }))

    // Extract and invoke the undo callback
    await waitFor(() => {
      expect(mockSonnerToast).toHaveBeenCalled()
    })
    const toastCall = mockSonnerToast.mock.calls[mockSonnerToast.mock.calls.length - 1]
    const undoAction = toastCall[1].action
    await undoAction.onClick()

    // Should re-link the goal
    expect(GoalApi.linkToSession).toHaveBeenCalledWith("session-1", "goal-1")

    // Should restore InProgress status
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        "goal-1",
        expect.objectContaining({ status: ItemStatus.InProgress })
      )
    })
  })

  it("unlink does not change goal status on past (readOnly) session", async () => {
    const mockUnlinkResult = { isOk: () => true, isErr: () => false, match: (ok: () => void) => ok() }
    vi.mocked(GoalApi.unlinkFromSession).mockResolvedValue(mockUnlinkResult as any)
    setupMocks()

    render(
      <GoalPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
        readOnly
      />
    )

    // readOnly hides the info (flip) button, so remove can't be reached
    const infoButtons = screen.queryAllByRole("button", {
      name: /goal options for/i,
    })
    expect(infoButtons).toHaveLength(0)
  })

  it("inline create form creates a new goal", async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue(createMockGoal({ title: "New goal" }))

    setupMocks({ sessionGoals: [] })

    render(
      <GoalPanel
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
      <GoalPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Step 1: At limit (3/3) — click "Add goal" enters swap-selection mode
    const addGoalButtons = screen.getAllByRole("button", { name: /add goal/i })
    await user.click(addGoalButtons[0])

    // Should show swap selection prompt
    expect(screen.getAllByText(/select an existing goal to replace/i).length).toBeGreaterThanOrEqual(1)

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

  it("flips card to back face and enters edit mode on Edit click", async () => {
    const user = userEvent.setup()
    setupMocks()

    render(
      <GoalPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Flip the card to reveal back-face actions
    const infoButtons = screen.getAllByRole("button", {
      name: /goal options for/i,
    })
    expect(infoButtons.length).toBeGreaterThanOrEqual(1)
    await user.click(infoButtons[0])

    // Click Edit on the back face
    await user.click(screen.getByRole("button", { name: /edit/i }))

    // Should show pre-populated input with current title
    const titleInput = screen.getByDisplayValue("Improve technical leadership")
    expect(titleInput).toBeInTheDocument()

    // Should show pre-populated textarea with current body
    const bodyInput = screen.getByDisplayValue("Work on active listening")
    expect(bodyInput).toBeInTheDocument()

    // Save button should be disabled (no changes yet)
    const saveButton = screen.getByRole("button", { name: /save/i })
    expect(saveButton).toBeDisabled()
  })

  it("editing a goal calls updateGoal with new title and body", async () => {
    const user = userEvent.setup()
    mockUpdate.mockResolvedValue(goal1)
    setupMocks()

    render(
      <GoalPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Flip card then enter edit mode
    const infoButtons = screen.getAllByRole("button", {
      name: /goal options for/i,
    })
    await user.click(infoButtons[0])
    await user.click(screen.getByRole("button", { name: /edit/i }))

    // Clear and type new title
    const titleInput = screen.getByDisplayValue("Improve technical leadership")
    await user.clear(titleInput)
    await user.type(titleInput, "Updated goal title")

    // Save should now be enabled
    const saveButton = screen.getByRole("button", { name: /save/i })
    expect(saveButton).not.toBeDisabled()

    await user.click(saveButton)

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        "goal-1",
        expect.objectContaining({
          title: "Updated goal title",
          body: "Work on active listening",
        })
      )
    })
  })

  it("cancelling edit returns to display mode without saving", async () => {
    const user = userEvent.setup()
    setupMocks()

    render(
      <GoalPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Flip card then enter edit mode
    const infoButtons = screen.getAllByRole("button", {
      name: /goal options for/i,
    })
    await user.click(infoButtons[0])
    await user.click(screen.getByRole("button", { name: /edit/i }))

    // Type changes
    const titleInput = screen.getByDisplayValue("Improve technical leadership")
    await user.clear(titleInput)
    await user.type(titleInput, "Something else")

    // Cancel
    await user.click(screen.getByRole("button", { name: /cancel/i }))

    // Should return to display mode with original title
    expect(screen.getAllByText("Improve technical leadership").length).toBeGreaterThanOrEqual(1)

    // updateGoal should NOT have been called
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("does not show edit icon on readOnly sessions", () => {
    setupMocks()

    render(
      <GoalPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
        readOnly
      />
    )

    // readOnly hides the info (flip) button, so edit/remove can't be reached
    const infoButtons = screen.queryAllByRole("button", {
      name: /goal options for/i,
    })
    expect(infoButtons).toHaveLength(0)
  })

  it("clicking outside the panel dismisses the add-goal flow", async () => {
    const user = userEvent.setup()
    setupMocks({ sessionGoals: [], allGoals: [goal1, goal2] })

    const { container } = render(
      <div>
        <GoalPanel
          coachingSessionId="session-1"
          coachingRelationshipId="rel-1"
        />
        <div data-testid="outside-area">Notes area</div>
      </div>
    )

    // Enter the browsing flow
    const addGoalButtons = screen.getAllByRole("button", { name: /add goal/i })
    await user.click(addGoalButtons[0])

    // Should be in browsing mode with search input visible
    expect(screen.getByPlaceholderText(/search goals/i)).toBeInTheDocument()

    // Click outside the panel
    await user.click(screen.getByTestId("outside-area"))

    // Should return to idle — search input gone, "Add goal" button back
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/search goals/i)).not.toBeInTheDocument()
    })
    expect(screen.getAllByRole("button", { name: /add goal/i }).length).toBeGreaterThanOrEqual(1)
  })

  it("clicking inside the panel does not dismiss the flow", async () => {
    const user = userEvent.setup()
    setupMocks({ sessionGoals: [], allGoals: [goal1, goal2] })

    render(
      <GoalPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Enter the browsing flow
    const addGoalButtons = screen.getAllByRole("button", { name: /add goal/i })
    await user.click(addGoalButtons[0])

    // Click the search input (inside the panel)
    const searchInput = screen.getByPlaceholderText(/search goals/i)
    await user.click(searchInput)

    // Should still be in browsing mode
    expect(searchInput).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /create new/i }).length).toBeGreaterThanOrEqual(1)
  })
})
