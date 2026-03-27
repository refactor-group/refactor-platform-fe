import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { CoachingSessionPanel } from "@/components/ui/coaching-sessions/coaching-session-panel"
import { createMockGoal, createMockAgreement } from "../../../test-utils"
import { ItemStatus } from "@/types/general"
import { GoalProgress } from "@/types/goal-progress"
import { None } from "@/types/option"
import { DateTime } from "ts-luxon"

// Mock matchMedia to simulate desktop viewport (md+ breakpoint)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === "(min-width: 768px)",
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock goal API hooks
const mockRefreshSession = vi.fn()
const mockRefreshAll = vi.fn()
const mockCreateGoal = vi.fn()
const mockUpdateGoal = vi.fn()

vi.mock("@/lib/api/goals", () => ({
  useGoalsBySession: vi.fn(),
  useGoalList: vi.fn(),
  useGoalMutation: vi.fn(() => ({
    create: mockCreateGoal,
    update: mockUpdateGoal,
    delete: vi.fn(),
    createNested: vi.fn(),
    deleteNested: vi.fn(),
  })),
  GoalApi: {
    linkToSession: vi.fn(),
    unlinkFromSession: vi.fn(),
  },
}))

// Mock agreement API hooks
const mockRefreshAgreements = vi.fn()
const mockCreateAgreement = vi.fn()
const mockUpdateAgreement = vi.fn()
const mockDeleteAgreement = vi.fn()

vi.mock("@/lib/api/agreements", () => ({
  useAgreementList: vi.fn(),
  useAgreementMutation: vi.fn(() => ({
    create: mockCreateAgreement,
    update: mockUpdateAgreement,
    delete: mockDeleteAgreement,
    isLoading: false,
    error: null,
  })),
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
    locale: "en-US",
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
import { useGoalsBySession, useGoalList } from "@/lib/api/goals"
import { useAgreementList } from "@/lib/api/agreements"

const goal1 = createMockGoal({
  id: "goal-1",
  title: "Improve technical leadership",
  status: ItemStatus.InProgress,
})

const agreement1 = createMockAgreement({
  id: "agreement-1",
  body: "Weekly check-in every Tuesday",
  created_at: DateTime.fromISO("2026-03-15T10:00:00.000Z"),
})

const agreement2 = createMockAgreement({
  id: "agreement-2",
  body: "Share notes within 24 hours",
  created_at: DateTime.fromISO("2026-03-16T10:00:00.000Z"),
})

function setupMocks({
  sessionGoals = [goal1],
  allGoals = [goal1],
  agreements = [agreement1, agreement2],
}: {
  sessionGoals?: ReturnType<typeof createMockGoal>[]
  allGoals?: ReturnType<typeof createMockGoal>[]
  agreements?: ReturnType<typeof createMockAgreement>[]
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

  vi.mocked(useAgreementList).mockReturnValue({
    agreements,
    isLoading: false,
    isError: false,
    refresh: mockRefreshAgreements,
  })
}

describe("CoachingSessionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("defaults to Goals section with goal content visible", () => {
    setupMocks()
    render(
      <CoachingSessionPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // Goal title should be visible
    const titles = screen.getAllByText("Improve technical leadership")
    expect(titles.length).toBeGreaterThanOrEqual(1)
  })

  it("renders the section selector dropdown", () => {
    setupMocks()
    render(
      <CoachingSessionPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    // The combobox trigger for the section selector should exist
    const selectors = screen.getAllByRole("combobox")
    expect(selectors.length).toBeGreaterThanOrEqual(1)
  })

  it("shows 'Goals (1/3)' in the selector when goals are linked", () => {
    setupMocks()
    render(
      <CoachingSessionPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    const labels = screen.getAllByText("Goals (1/3)")
    expect(labels.length).toBeGreaterThanOrEqual(1)
  })

  it("calls useAgreementList with the coaching session ID", () => {
    setupMocks()
    render(
      <CoachingSessionPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    expect(useAgreementList).toHaveBeenCalledWith("session-1")
  })

  it("shows 'Add' button when goals section is active", () => {
    setupMocks()
    render(
      <CoachingSessionPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
      />
    )

    const addButtons = screen.getAllByRole("button", { name: /^add$/i })
    expect(addButtons.length).toBeGreaterThanOrEqual(1)
  })

  it("hides add buttons when readOnly", () => {
    setupMocks()
    render(
      <CoachingSessionPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
        readOnly
      />
    )

    expect(screen.queryByRole("button", { name: /^add$/i })).not.toBeInTheDocument()
  })

  it("shows undo toast when deleting an agreement", async () => {
    const user = userEvent.setup()
    mockDeleteAgreement.mockResolvedValue(agreement1)
    setupMocks()

    render(
      <CoachingSessionPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
        defaultSection="agreements"
      />
    )

    // Flip the agreement card to reveal back-face actions (first match = desktop)
    const infoButtons = screen.getAllByRole("button", { name: /agreement options/i })
    await user.click(infoButtons[0])

    // Click Delete on the back face
    const deleteButton = screen.getAllByRole("button", { name: /delete/i })[0]
    await user.click(deleteButton)

    // Should show undo toast via sonner
    await waitFor(() => {
      expect(mockSonnerToast).toHaveBeenCalledWith(
        expect.stringContaining("deleted"),
        expect.objectContaining({
          action: expect.objectContaining({ label: "Undo" }),
        })
      )
    })
  })

  it("undo restores the deleted agreement", async () => {
    const user = userEvent.setup()
    mockDeleteAgreement.mockResolvedValue(agreement1)
    mockCreateAgreement.mockResolvedValue(agreement1)
    setupMocks()

    render(
      <CoachingSessionPanel
        coachingSessionId="session-1"
        coachingRelationshipId="rel-1"
        defaultSection="agreements"
      />
    )

    // Flip and delete (first match = desktop)
    await user.click(screen.getAllByRole("button", { name: /agreement options/i })[0])
    await user.click(screen.getAllByRole("button", { name: /delete/i })[0])

    // Extract and invoke the undo callback
    await waitFor(() => {
      expect(mockSonnerToast).toHaveBeenCalled()
    })
    const toastCall = mockSonnerToast.mock.calls[mockSonnerToast.mock.calls.length - 1]
    const undoAction = toastCall[1].action
    await undoAction.onClick()

    // Should re-create the agreement
    expect(mockCreateAgreement).toHaveBeenCalledWith(agreement1)
  })
})
