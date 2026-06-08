import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { CoachingSessionPanel } from "@/components/ui/coaching-sessions/coaching-session-panel"
import { defaultCoachingSessionTopic } from "@/types/coaching-session-topic"
import type { CoachingSessionTopic } from "@/types/coaching-session-topic"
import { None } from "@/types/option"

// Desktop viewport so the desktop layout (and its inline Topics add) renders.
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

vi.mock("@/lib/api/goals", () => ({
  useGoalsBySession: vi.fn(() => ({ goals: [], isLoading: false, isError: false, refresh: vi.fn() })),
  useGoalList: vi.fn(() => ({ goals: [], isLoading: false, isError: false, refresh: vi.fn() })),
  useGoal: vi.fn(() => ({ goal: undefined, isLoading: false, isError: false, refresh: vi.fn() })),
  useGoalMutation: vi.fn(() => ({
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createNested: vi.fn(),
    deleteNested: vi.fn(),
  })),
  GoalApi: { linkToSession: vi.fn(), unlinkFromSession: vi.fn() },
}))

vi.mock("@/lib/api/agreements", () => ({
  useAgreementList: vi.fn(() => ({ agreements: [], isLoading: false, isError: false, refresh: vi.fn() })),
  useAgreementMutation: vi.fn(() => ({
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    isLoading: false,
    error: null,
  })),
}))

// Topic API hooks under test
const mockRefreshTopics = vi.fn()
const mockCreateTopic = vi.fn()
const mockUpdateTopic = vi.fn()
const mockDeleteTopic = vi.fn()

vi.mock("@/lib/api/coaching-session-topics", () => ({
  useCoachingSessionTopicList: vi.fn(),
  useCoachingSessionTopicMutation: vi.fn(() => ({
    create: mockCreateTopic,
    update: mockUpdateTopic,
    delete: mockDeleteTopic,
    reorder: vi.fn(),
    isLoading: false,
    error: null,
  })),
}))

vi.mock("@/lib/api/goal-progress", () => ({
  useGoalProgress: vi.fn(() => ({
    progressMetrics: undefined,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  })),
}))

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: vi.fn((selector: (state: any) => any) => selector({ userId: "user-1" })),
}))

vi.mock("@/lib/hooks/use-current-coaching-session", () => ({
  useCurrentCoachingSession: vi.fn(() => ({
    currentCoachingSessionId: "session-1",
    currentCoachingSession: { id: "session-1", date: "2026-03-28T10:00:00.000Z", coaching_relationship_id: "rel-1" },
    isError: false,
    isLoading: false,
    refresh: vi.fn(),
  })),
}))

vi.mock("@/lib/hooks/use-current-coaching-relationship", () => ({
  useCurrentCoachingRelationship: vi.fn(() => ({
    currentCoachingRelationshipId: "rel-1",
    currentCoachingRelationship: {
      id: "rel-1",
      coach_id: "coach-1",
      coachee_id: "coachee-1",
      organization_id: "org-1",
      coach_first_name: "Jim",
      coach_last_name: "Hodapp",
      coachee_first_name: "Caleb",
      coachee_last_name: "Bourg",
    },
    isLoading: false,
    isError: false,
    setCurrentCoachingRelationshipId: vi.fn(),
    refresh: vi.fn(),
  })),
}))

vi.mock("@/lib/api/actions", () => ({
  useActionMutation: vi.fn(() => ({ create: vi.fn(), update: vi.fn(), delete: vi.fn(), isLoading: false, error: null })),
}))

vi.mock("@/lib/api/user-actions", () => ({
  useUserActionsList: vi.fn(() => ({ actions: [], isLoading: false, isError: false, refresh: vi.fn() })),
}))

vi.mock("@/lib/api/coaching-sessions", () => ({
  useCoachingSessionList: vi.fn(() => ({ coachingSessions: [], isLoading: false, isError: false, refresh: vi.fn() })),
}))

vi.mock("@/site.config", () => ({
  siteConfig: { locale: "en-US", env: { backendServiceURL: "http://localhost:3000" } },
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}))

import { useCoachingSessionTopicList } from "@/lib/api/coaching-session-topics"

const topic = (over: Partial<CoachingSessionTopic>): CoachingSessionTopic => ({
  ...defaultCoachingSessionTopic(),
  ...over,
})

function setTopics(topics: CoachingSessionTopic[]) {
  vi.mocked(useCoachingSessionTopicList).mockReturnValue({
    topics,
    isLoading: false,
    isError: false,
    refresh: mockRefreshTopics,
  })
}

function renderPanel() {
  return render(
    <CoachingSessionPanel
      coachingSessionId="session-1"
      coachingRelationshipId="rel-1"
      noteSelection={None}
    />
  )
}

describe("CoachingSessionPanel — Topics wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keys the topic list hook to the coaching session id", () => {
    setTopics([])
    renderPanel()
    expect(useCoachingSessionTopicList).toHaveBeenCalledWith("session-1")
  })

  it("defaults to the Topics section and renders topic bodies", () => {
    setTopics([
      topic({ id: "t1", user_id: "user-1", body: "Talk about the reorg" }),
      topic({ id: "t2", user_id: "user-2", body: "Discuss the promotion path" }),
    ])
    renderPanel()
    // Topics is the default section: bodies are visible without switching.
    expect(screen.getAllByText("Talk about the reorg").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Discuss the promotion path").length).toBeGreaterThanOrEqual(1)
  })

  it("calls the topic create mutation when adding via the inline input", async () => {
    const user = userEvent.setup()
    setTopics([])
    renderPanel()

    const input = screen.getAllByPlaceholderText(/add a topic/i)[0]
    await user.type(input, "Prep for the review")
    await user.keyboard("{Enter}")

    await waitFor(() => {
      expect(mockCreateTopic).toHaveBeenCalledWith("Prep for the review")
    })
  })

  it("calls the topic update mutation when editing a topic body", async () => {
    const user = userEvent.setup()
    setTopics([topic({ id: "t1", user_id: "user-1", body: "Original body" })])
    renderPanel()

    await user.click(screen.getAllByText("Original body")[0])
    const editInput = screen.getAllByRole("textbox", { name: /edit topic/i })[0]
    await user.clear(editInput)
    await user.type(editInput, "Edited body")
    await user.keyboard("{Enter}")

    await waitFor(() => {
      expect(mockUpdateTopic).toHaveBeenCalledWith("t1", { body: "Edited body" })
    })
  })

  it("calls the topic delete mutation only for the viewer's own topic", async () => {
    const user = userEvent.setup()
    setTopics([
      topic({ id: "mine", user_id: "user-1", body: "My topic" }),
      topic({ id: "theirs", user_id: "user-2", body: "Their topic" }),
    ])
    renderPanel()

    // Exactly one delete affordance — the viewer's own topic in the visible
    // (desktop) layout. The other author's topic contributes none, proving the
    // author-only gate (the mobile sheet is closed, so it renders nothing).
    const deleteButtons = screen.getAllByRole("button", { name: /delete topic/i })
    expect(deleteButtons).toHaveLength(1)
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(mockDeleteTopic).toHaveBeenCalledWith("mine")
    })
    expect(mockDeleteTopic).not.toHaveBeenCalledWith("theirs")
  })
})
