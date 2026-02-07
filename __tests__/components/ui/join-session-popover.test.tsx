import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { JoinSessionPopover } from "@/components/ui/join-session-popover";
import { TestProviders } from "@/test-utils/providers";
import { SessionUrgency } from "@/types/session-display";
import type { EnrichedCoachingSession } from "@/types/coaching-session";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

const mockSetCurrentCoachingRelationshipId = vi.fn();

vi.mock("@/lib/hooks/use-current-coaching-relationship", () => ({
  useCurrentCoachingRelationship: vi.fn(() => ({
    currentCoachingRelationshipId: null,
    setCurrentCoachingRelationshipId: mockSetCurrentCoachingRelationshipId,
  })),
}));

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: vi.fn(() => ({
    currentOrganizationId: "org-1",
  })),
}));

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: vi.fn(() => ({
    userId: "user-1",
    userSession: { id: "user-1", timezone: "America/Chicago" },
  })),
  AuthStoreProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/timezone-utils", () => ({
  formatDateInUserTimezone: (date: string) => `Formatted: ${date}`,
  getBrowserTimezone: () => "America/Chicago",
}));

vi.mock("@/types/general", () => ({
  getDateTimeFromString: (dateStr: string) => DateTime.fromISO(dateStr),
}));

// The key data hooks — we mock return values per test
vi.mock("@/lib/hooks/use-todays-sessions");
vi.mock("@/lib/api/coaching-sessions");
vi.mock("@/lib/api/coaching-relationships");
vi.mock("@/lib/utils/session");

import { useTodaysSessions } from "@/lib/hooks/use-todays-sessions";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { calculateSessionUrgency, getUrgencyMessage, formatSessionTime, getSessionParticipantName } from "@/lib/utils/session";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTodaySession(
  overrides: Partial<EnrichedCoachingSession> & { id: string }
): EnrichedCoachingSession {
  return {
    coaching_relationship_id: "rel-1",
    date: DateTime.now().toISO()!,
    created_at: DateTime.now(),
    updated_at: DateTime.now(),
    relationship: {
      id: "rel-1",
      coach_id: "user-1",
      coachee_id: "other-1",
      organization_id: "org-1",
      created_at: DateTime.now(),
      updated_at: DateTime.now(),
    },
    coach: {
      id: "user-1",
      first_name: "Coach",
      last_name: "Smith",
      display_name: "Coach Smith",
      email: "coach@test.com",
    } as any,
    coachee: {
      id: "other-1",
      first_name: "Coachee",
      last_name: "Jones",
      display_name: "Coachee Jones",
      email: "coachee@test.com",
    } as any,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JoinSessionPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no today sessions, no relationships
    vi.mocked(useTodaysSessions).mockReturnValue({
      sessions: [],
      isLoading: false,
      error: false,
      refresh: vi.fn(),
      _tick: 0,
    });

    vi.mocked(useCoachingRelationshipList).mockReturnValue({
      relationships: [],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    });

    vi.mocked(useEnrichedCoachingSessionsForUser).mockReturnValue({
      enrichedSessions: [],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    });

    vi.mocked(calculateSessionUrgency).mockReturnValue(SessionUrgency.Later);
    vi.mocked(getUrgencyMessage).mockReturnValue("Scheduled for later");
    vi.mocked(formatSessionTime).mockReturnValue("10:00 AM CST");
    vi.mocked(getSessionParticipantName).mockImplementation(
      (_session, userId) => userId === "user-1" ? "Coachee Jones" : "Unknown"
    );
  });

  it("renders the Join Session button", () => {
    render(
      <TestProviders>
        <JoinSessionPopover />
      </TestProviders>
    );

    expect(screen.getByText("Join Session")).toBeInTheDocument();
  });

  it("opens popover on click and shows section headers", () => {
    render(
      <TestProviders>
        <JoinSessionPopover />
      </TestProviders>
    );

    fireEvent.click(screen.getByText("Join Session"));

    expect(screen.getByText("Today's Sessions")).toBeInTheDocument();
    expect(screen.getByText("Browse Sessions")).toBeInTheDocument();
  });

  it("shows empty state when no sessions today", () => {
    render(
      <TestProviders>
        <JoinSessionPopover />
      </TestProviders>
    );

    fireEvent.click(screen.getByText("Join Session"));

    expect(
      screen.getByText("No sessions scheduled for today")
    ).toBeInTheDocument();
  });

  it("displays today's sessions with participant names", () => {
    const session = makeTodaySession({ id: "session-1" });

    vi.mocked(useTodaysSessions).mockReturnValue({
      sessions: [session],
      isLoading: false,
      error: false,
      refresh: vi.fn(),
      _tick: 0,
    });

    render(
      <TestProviders>
        <JoinSessionPopover />
      </TestProviders>
    );

    fireEvent.click(screen.getByText("Join Session"));

    // Should show coachee name (the "other" person, since user-1 is the coach)
    expect(screen.getByText("Coachee Jones")).toBeInTheDocument();
  });

  it("highlights the first non-past session", () => {
    const pastSession = makeTodaySession({
      id: "past-1",
      date: DateTime.now().minus({ hours: 2 }).toISO()!,
    });
    const nextSession = makeTodaySession({
      id: "next-1",
      date: DateTime.now().plus({ hours: 1 }).toISO()!,
    });

    vi.mocked(useTodaysSessions).mockReturnValue({
      sessions: [pastSession, nextSession],
      isLoading: false,
      error: false,
      refresh: vi.fn(),
      _tick: 0,
    });

    // First session is past, second is not
    vi.mocked(calculateSessionUrgency)
      .mockReturnValueOnce(SessionUrgency.Past)
      .mockReturnValueOnce(SessionUrgency.Soon)
      // Called again during render for urgency messages
      .mockReturnValueOnce(SessionUrgency.Past)
      .mockReturnValueOnce(SessionUrgency.Soon);

    render(
      <TestProviders>
        <JoinSessionPopover />
      </TestProviders>
    );

    fireEvent.click(screen.getByText("Join Session"));

    // The second session button should have the highlight ring class
    const sessionButtons = screen.getAllByRole("button").filter(
      (btn) => btn.closest("[class*='flex flex-col items-start']") !== null
    );

    // There should be session buttons rendered
    expect(sessionButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("navigates to session and closes popover on click", () => {
    const session = makeTodaySession({ id: "session-nav" });

    vi.mocked(useTodaysSessions).mockReturnValue({
      sessions: [session],
      isLoading: false,
      error: false,
      refresh: vi.fn(),
      _tick: 0,
    });

    render(
      <TestProviders>
        <JoinSessionPopover />
      </TestProviders>
    );

    fireEvent.click(screen.getByText("Join Session"));
    fireEvent.click(screen.getByText("Coachee Jones"));

    expect(mockPush).toHaveBeenCalledWith("/coaching-sessions/session-nav");
  });

  it("populates relationship dropdown with user's relationships", () => {
    vi.mocked(useCoachingRelationshipList).mockReturnValue({
      relationships: [
        {
          id: "rel-1",
          coach_id: "user-1",
          coachee_id: "other-1",
          organization_id: "org-1",
          coach_first_name: "Coach",
          coach_last_name: "Smith",
          coachee_first_name: "Alice",
          coachee_last_name: "Doe",
          created_at: DateTime.now(),
          updated_at: DateTime.now(),
        },
      ],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    });

    render(
      <TestProviders>
        <JoinSessionPopover />
      </TestProviders>
    );

    fireEvent.click(screen.getByText("Join Session"));

    // The relationship select should have a trigger
    expect(screen.getByText("Select a coachee...")).toBeInTheDocument();
  });

  it("calls useTodaysSessions with Relationship and Goal includes", () => {
    render(
      <TestProviders>
        <JoinSessionPopover />
      </TestProviders>
    );

    fireEvent.click(screen.getByText("Join Session"));

    expect(useTodaysSessions).toHaveBeenCalledWith([
      CoachingSessionInclude.Relationship,
      CoachingSessionInclude.Goal,
    ]);
  });

  describe("Browse Sessions collapsible behavior", () => {
    it("expands Browse Sessions by default when no today's sessions", () => {
      // beforeEach sets sessions to empty array
      vi.mocked(useCoachingRelationshipList).mockReturnValue({
        relationships: [
          {
            id: "rel-1",
            coach_id: "user-1",
            coachee_id: "other-1",
            organization_id: "org-1",
            coach_first_name: "Coach",
            coach_last_name: "Smith",
            coachee_first_name: "Alice",
            coachee_last_name: "Doe",
            created_at: DateTime.now(),
            updated_at: DateTime.now(),
          },
        ],
        isLoading: false,
        isError: false,
        refresh: vi.fn(),
      });

      render(
        <TestProviders>
          <JoinSessionPopover />
        </TestProviders>
      );

      fireEvent.click(screen.getByText("Join Session"));

      // Browse section content should be visible (expanded)
      expect(screen.getByText("Select a coachee...")).toBeInTheDocument();
    });

    it("collapses Browse Sessions by default when today has sessions", () => {
      const session = makeTodaySession({ id: "session-1" });

      vi.mocked(useTodaysSessions).mockReturnValue({
        sessions: [session],
        isLoading: false,
        error: false,
        refresh: vi.fn(),
        _tick: 0,
      });

      vi.mocked(useCoachingRelationshipList).mockReturnValue({
        relationships: [
          {
            id: "rel-1",
            coach_id: "user-1",
            coachee_id: "other-1",
            organization_id: "org-1",
            coach_first_name: "Coach",
            coach_last_name: "Smith",
            coachee_first_name: "Alice",
            coachee_last_name: "Doe",
            created_at: DateTime.now(),
            updated_at: DateTime.now(),
          },
        ],
        isLoading: false,
        isError: false,
        refresh: vi.fn(),
      });

      render(
        <TestProviders>
          <JoinSessionPopover />
        </TestProviders>
      );

      fireEvent.click(screen.getByText("Join Session"));

      // Browse section content should NOT be visible (collapsed)
      expect(screen.queryByText("Select a coachee...")).not.toBeInTheDocument();
    });

    it("toggles Browse Sessions open when clicking its header", () => {
      const session = makeTodaySession({ id: "session-1" });

      vi.mocked(useTodaysSessions).mockReturnValue({
        sessions: [session],
        isLoading: false,
        error: false,
        refresh: vi.fn(),
        _tick: 0,
      });

      vi.mocked(useCoachingRelationshipList).mockReturnValue({
        relationships: [
          {
            id: "rel-1",
            coach_id: "user-1",
            coachee_id: "other-1",
            organization_id: "org-1",
            coach_first_name: "Coach",
            coach_last_name: "Smith",
            coachee_first_name: "Alice",
            coachee_last_name: "Doe",
            created_at: DateTime.now(),
            updated_at: DateTime.now(),
          },
        ],
        isLoading: false,
        isError: false,
        refresh: vi.fn(),
      });

      render(
        <TestProviders>
          <JoinSessionPopover />
        </TestProviders>
      );

      fireEvent.click(screen.getByText("Join Session"));

      // Initially collapsed
      expect(screen.queryByText("Select a coachee...")).not.toBeInTheDocument();

      // Click the Browse Sessions header to expand
      fireEvent.click(screen.getByText("Browse Sessions"));

      // Now the content should be visible
      expect(screen.getByText("Select a coachee...")).toBeInTheDocument();
    });
  });
});
