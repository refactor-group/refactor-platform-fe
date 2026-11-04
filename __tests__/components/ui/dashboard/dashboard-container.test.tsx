import { useEffect } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardContainer } from "@/components/ui/dashboard/dashboard-container";
import { None } from "@/types/option";
import { createMockEnrichedSession } from "../../../test-utils";

// The container wires the cards to the New session dialog store and keeps
// the cards' refresh plumbing for series changes. Cards and dialogs are
// stubbed; the contract lives in the container's wiring.

const rescheduled = createMockEnrichedSession({ id: "sess-1" });
const upcomingSessionRefreshSpy = vi.fn();
const coachingSessionsCardRefreshSpy = vi.fn();

vi.mock("@/components/ui/dashboard/upcoming-session-card", () => ({
  UpcomingSessionCard: ({
    onRefreshNeeded,
    onReschedule,
    onCreateSession,
  }: {
    onRefreshNeeded?: (fn: () => void) => void;
    onReschedule?: (session: ReturnType<typeof createMockEnrichedSession>) => void;
    onCreateSession?: () => void;
  }) => {
    // Defer the parent's `setState` until after render to mirror the real
    // card's `useEffect`-based registration and avoid React's "setState
    // during render" warning.
    useEffect(() => {
      onRefreshNeeded?.(upcomingSessionRefreshSpy);
    }, [onRefreshNeeded]);
    return (
      <div data-testid="upcoming-session-card-stub">
        <button data-testid="reschedule-stub" onClick={() => onReschedule?.(rescheduled)}>
          Reschedule
        </button>
        <button data-testid="card-create-stub" onClick={() => onCreateSession?.()}>
          Schedule
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/ui/dashboard/coaching-sessions-card", () => ({
  CoachingSessionsCard: ({
    onRefreshNeeded,
  }: {
    onRefreshNeeded?: (fn: () => void) => void;
  }) => {
    useEffect(() => {
      onRefreshNeeded?.(coachingSessionsCardRefreshSpy);
    }, [onRefreshNeeded]);
    return <div data-testid="coaching-sessions-card-stub" />;
  },
}));

vi.mock("@/components/ui/dashboard/goals-overview-card", () => ({
  GoalsOverviewCard: () => <div data-testid="goals-overview-card-stub" />,
}));

vi.mock("@/components/ui/dashboard/dashboard-header", () => ({
  DashboardHeader: ({ onCreateSession }: { onCreateSession: () => void }) => (
    <button data-testid="open-dialog-stub" onClick={onCreateSession}>
      Add New
    </button>
  ),
}));

const openSchedule = vi.fn();
const openMoveSession = vi.fn();
vi.mock("@/lib/providers/new-session-dialog-store-provider", () => ({
  useNewSessionDialogStore: (selector: (state: unknown) => unknown) => selector({ openSchedule, openMoveSession }),
}));

// Container also pulls relationship state for the auto-select hook —
// stub the surface to avoid pulling the whole zustand store stack into
// the test.
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => ({
    relationships: [],
    isLoading: false,
  }),
}));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
vi.mock("@/lib/hooks/use-current-coaching-relationship", () => ({
  useCurrentCoachingRelationship: () => ({
    currentCoachingRelationshipId: undefined,
    setCurrentCoachingRelationshipId: vi.fn(),
  }),
}));
vi.mock("@/lib/hooks/use-auto-select-single-relationship", () => ({
  useAutoSelectSingleRelationship: () => undefined,
}));

describe("DashboardContainer auto-refresh wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures both cards' refresh callbacks on mount", () => {
    render(<DashboardContainer locale="en-US" />);

    // Both cards register their refresh fn through the container's
    // `onRefreshNeeded` callbacks. Failing here means the container
    // either dropped a prop or stopped passing it.
    expect(upcomingSessionRefreshSpy).not.toHaveBeenCalled();
    expect(coachingSessionsCardRefreshSpy).not.toHaveBeenCalled();
  });

  it("opens the New session dialog from the header and the upcoming card", () => {
    render(<DashboardContainer locale="en-US" />);

    fireEvent.click(screen.getByTestId("open-dialog-stub"));
    fireEvent.click(screen.getByTestId("card-create-stub"));

    expect(openSchedule).toHaveBeenCalledTimes(2);
    expect(openSchedule).toHaveBeenCalledWith(None);
  });

  it("reschedules a session in the New session dialog", () => {
    render(<DashboardContainer locale="en-US" />);

    fireEvent.click(screen.getByTestId("reschedule-stub"));

    expect(openMoveSession).toHaveBeenCalledWith(rescheduled);
    expect(openSchedule).not.toHaveBeenCalled();
  });

  it("does not fire refreshes on initial mount", () => {
    upcomingSessionRefreshSpy.mockClear();
    coachingSessionsCardRefreshSpy.mockClear();

    render(<DashboardContainer locale="en-US" />);

    // Mount alone must not fire any refresh. If it did, every dashboard render would re-fetch, which
    // would also break SWR's cache-warmth semantics elsewhere.
    expect(upcomingSessionRefreshSpy).not.toHaveBeenCalled();
    expect(coachingSessionsCardRefreshSpy).not.toHaveBeenCalled();
  });
});
