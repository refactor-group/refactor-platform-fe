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
})
