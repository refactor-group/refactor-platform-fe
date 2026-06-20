import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Some, None, type Option } from "@/types/option";
import { CoachingSessionTitle } from "@/components/ui/coaching-sessions/coaching-session-title";

const mockUpdateTitle = vi.fn();
const mockRefresh = vi.fn();
const mockToastError = vi.fn();

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: (...args: unknown[]) => mockToastError(...args) }),
}));

let sessionTitle: Option<string> = None;
let goalTitle = "";
let topicBodies: string[] = [];

vi.mock("@/lib/hooks/use-current-coaching-session", () => ({
  useCurrentCoachingSession: vi.fn(() => ({
    currentCoachingSessionId: "session-1",
    currentCoachingSession: {
      id: "session-1",
      coaching_relationship_id: "rel-1",
      date: "2026-06-08T10:00:00.000Z",
      duration_minutes: 60,
      title: sessionTitle,
    },
    isLoading: false,
    isError: false,
    refresh: mockRefresh,
  })),
}));

vi.mock("@/lib/hooks/use-current-coaching-relationship", () => ({
  useCurrentCoachingRelationship: vi.fn(() => ({
    currentCoachingRelationshipId: "rel-1",
    currentCoachingRelationship: {
      id: "rel-1",
      coach_id: "coach-1",
      coachee_id: "coachee-1",
      organization_id: "org-1",
      coach_first_name: "Jordan",
      coach_last_name: "Smith",
      coachee_first_name: "Alex",
      coachee_last_name: "Chen",
    },
    isLoading: false,
    isError: false,
    setCurrentCoachingRelationshipId: vi.fn(),
    refresh: vi.fn(),
  })),
}));

vi.mock("@/lib/api/goals", () => ({
  useGoalsBySession: vi.fn(() => ({
    goals: goalTitle ? [{ title: goalTitle }] : [],
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  })),
}));

vi.mock("@/lib/api/coaching-session-topics", () => ({
  useCoachingSessionTopicList: vi.fn(() => ({
    topics: topicBodies.map((body) => ({ body })),
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  })),
}));

vi.mock("@/lib/api/coaching-sessions", () => ({
  CoachingSessionApi: {
    updateTitle: (...args: unknown[]) => mockUpdateTitle(...args),
  },
}));

vi.mock("@/components/ui/coaching-sessions/editor-cache-context", () => ({
  useEditorCache: vi.fn(() => ({
    presenceState: { users: new Map(), currentUser: null, isLoading: false },
  })),
}));

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: vi.fn((selector: (state: any) => any) =>
    selector({ userSession: { timezone: "America/Chicago" } })
  ),
}));

describe("CoachingSessionTitle — fallback resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionTitle = None;
    goalTitle = "";
    topicBodies = [];
    mockUpdateTitle.mockResolvedValue(undefined);
    mockRefresh.mockResolvedValue(undefined);
  });

  it("shows the human title when set", () => {
    sessionTitle = Some("Quarterly planning");
    render(<CoachingSessionTitle locale="en-US" />);
    expect(screen.getByText("Quarterly planning")).toBeInTheDocument();
  });

  it("falls back to the first topic (display order) ahead of the goal when unset", () => {
    sessionTitle = None;
    topicBodies = ["Career direction", "Team conflict"];
    goalTitle = "Improve leadership";
    render(<CoachingSessionTitle locale="en-US" />);
    expect(screen.getByText("Career direction")).toBeInTheDocument();
    expect(screen.queryByText("Improve leadership")).not.toBeInTheDocument();
  });

  it("falls back to the linked goal title when unset and no topics", () => {
    sessionTitle = None;
    goalTitle = "Improve leadership";
    render(<CoachingSessionTitle locale="en-US" />);
    expect(screen.getByText("Improve leadership")).toBeInTheDocument();
  });

  it("shows no placeholder title text when unset and no topic/goal (empty fallback)", () => {
    sessionTitle = None;
    goalTitle = "";
    topicBodies = [];
    render(<CoachingSessionTitle locale="en-US" />);
    // The session page uses an empty fallback — no "Coaching Session" filler.
    expect(screen.queryByText("Coaching Session")).not.toBeInTheDocument();
    // The add-title affordance remains for an untitled session.
    expect(
      screen.getByRole("button", { name: "Add a title" })
    ).toBeInTheDocument();
  });

  it("sets a non-empty document.title even when the heading is blank", () => {
    sessionTitle = None;
    goalTitle = "";
    topicBodies = [];
    render(<CoachingSessionTitle locale="en-US" />);
    // The on-page heading is blank, but the browser tab must not be.
    expect(document.title).toBe("Coaching Session");
  });

  it("sets document.title to the human title when set", () => {
    sessionTitle = Some("Quarterly planning");
    render(<CoachingSessionTitle locale="en-US" />);
    expect(document.title).toBe("Quarterly planning");
  });

  it("renders both participant names", () => {
    render(<CoachingSessionTitle locale="en-US" />);
    expect(screen.getByText("Jordan Smith")).toBeInTheDocument();
    expect(screen.getByText("Alex Chen")).toBeInTheDocument();
  });
});

describe("CoachingSessionTitle — save wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionTitle = None;
    goalTitle = "";
    topicBodies = [];
    mockUpdateTitle.mockResolvedValue(undefined);
    mockRefresh.mockResolvedValue(undefined);
  });

  it("commits a new title as Some and refreshes", async () => {
    render(<CoachingSessionTitle locale="en-US" />);
    fireEvent.click(screen.getByRole("button", { name: /add a title/i }));
    const input = screen.getByRole("textbox", { name: /session title/i });
    fireEvent.change(input, { target: { value: "New plan" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockUpdateTitle).toHaveBeenCalledTimes(1));
    expect(mockUpdateTitle).toHaveBeenCalledWith("session-1", Some("New plan"));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("commits an emptied title as None (clear)", async () => {
    sessionTitle = Some("Old title");
    render(<CoachingSessionTitle locale="en-US" />);
    fireEvent.click(screen.getByRole("button", { name: /edit title/i }));
    const input = screen.getByRole("textbox", { name: /session title/i });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockUpdateTitle).toHaveBeenCalledTimes(1));
    expect(mockUpdateTitle).toHaveBeenCalledWith("session-1", None);
  });

  it("shows an error toast when the save fails", async () => {
    mockUpdateTitle.mockRejectedValue(new Error("network down"));
    render(<CoachingSessionTitle locale="en-US" />);
    fireEvent.click(screen.getByRole("button", { name: /add a title/i }));
    const input = screen.getByRole("textbox", { name: /session title/i });
    fireEvent.change(input, { target: { value: "New plan" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to save title",
        expect.objectContaining({ description: expect.any(String) })
      )
    );
    // The save attempt still resolves (rejection is caught, not propagated).
    expect(mockUpdateTitle).toHaveBeenCalledTimes(1);
  });
});
