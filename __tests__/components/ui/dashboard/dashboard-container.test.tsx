import { useEffect } from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardContainer } from "@/components/ui/dashboard/dashboard-container";
import { DateTime } from "ts-luxon";
import { None } from "@/types/option";
import { createMockEnrichedSession } from "../../../test-utils";

// The container wires the briefing cards and the week panel to the New session dialog
// store, and refreshes the Next session card after a series changes. Cards and dialogs are
// stubbed; the contract lives in the container's wiring.

const rescheduled = createMockEnrichedSession({ id: "sess-1" });
const nextSessionRefreshSpy = vi.fn();

vi.mock("@/components/ui/dashboard/next-session-card", () => ({
  NextSessionCard: ({
    onRefreshNeeded,
    onCreateSession,
  }: {
    onRefreshNeeded?: (fn: () => void) => void;
    onCreateSession: () => void;
  }) => {
    // Register after render, as the real card's effect does.
    useEffect(() => {
      onRefreshNeeded?.(nextSessionRefreshSpy);
    }, [onRefreshNeeded]);
    return (
      <div data-testid="next-session-card-stub">
        <button data-testid="card-create-stub" onClick={() => onCreateSession()}>
          Schedule
        </button>
      </div>
    );
  },
}));

// The real briefing panel renders; pin its clock and zone.
vi.mock("@/lib/hooks/use-now", () => ({
  useNow: () => DateTime.fromISO("2026-11-19T20:20:00Z"),
}));
vi.mock("@/lib/hooks/use-user-timezone", () => ({
  useUserTimezone: () => "America/Chicago",
}));

let weekPanelProps: {
  onReschedule?: (session: ReturnType<typeof createMockEnrichedSession>) => void;
  onSeriesMutated?: () => void;
  onSchedule?: (date: unknown) => void;
} = {};
vi.mock("@/components/ui/dashboard/week-grid/week-panel", () => ({
  WeekPanel: (props: typeof weekPanelProps) => {
    weekPanelProps = props;
    return <div data-testid="week-panel-stub" />;
  },
}));

vi.mock("@/components/ui/dashboard/goals-overview-card", () => ({
  GoalsOverviewCard: () => <div data-testid="goals-overview-card-stub" />,
}));

const openSchedule = vi.fn();
const openMoveSession = vi.fn();
vi.mock("@/lib/providers/new-session-dialog-store-provider", () => ({
  useNewSessionDialogStore: (selector: (state: unknown) => unknown) => selector({ openSchedule, openMoveSession }),
}));

// Container also pulls relationship state for the auto-select hook;
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

  it("renders the Today's Briefing panel without an Add New button", () => {
    render(<DashboardContainer />);
    expect(screen.getByRole("heading", { name: "Today's Briefing" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add new/i })).not.toBeInTheDocument();
  });

  it("renders the week panel in place of the sessions card", () => {
    render(<DashboardContainer />);
    expect(screen.getByTestId("week-panel-stub")).toBeInTheDocument();
  });

  it("reschedules from the week panel in the New session dialog", () => {
    render(<DashboardContainer />);
    weekPanelProps.onReschedule?.(rescheduled);
    expect(openMoveSession).toHaveBeenCalledWith(rescheduled);
  });

  it("schedules from the week panel in the New session dialog", () => {
    render(<DashboardContainer />);
    weekPanelProps.onSchedule?.(None);
    expect(openSchedule).toHaveBeenCalledWith(None);
  });

  it("refreshes the Next session card after the week panel changes a series", () => {
    render(<DashboardContainer />);
    act(() => weekPanelProps.onSeriesMutated?.());
    expect(nextSessionRefreshSpy).toHaveBeenCalledTimes(1);
  });

  it("opens the New session dialog from the Next session card", () => {
    render(<DashboardContainer />);

    fireEvent.click(screen.getByTestId("card-create-stub"));

    expect(openSchedule).toHaveBeenCalledTimes(1);
    expect(openSchedule).toHaveBeenCalledWith(None);
  });

  it("does not fire refreshes on initial mount", () => {
    nextSessionRefreshSpy.mockClear();

    render(<DashboardContainer />);

    // Mount alone must not fire any refresh. If it did, every dashboard render would re-fetch, which
    // would also break SWR's cache-warmth semantics elsewhere.
    expect(nextSessionRefreshSpy).not.toHaveBeenCalled();
  });
});
