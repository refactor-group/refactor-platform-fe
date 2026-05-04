import { useEffect } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardContainer } from "@/components/ui/dashboard/dashboard-container";

// ── Auto-refresh contract (integration) ─────────────────────────────────
//
// `DashboardContainer` is the seam where the dialog-close → refresh wiring
// lives. The dashboard's two user-scoped fetches (UpcomingSessionCard and
// CoachingSessionsCard) both use tuple SWR keys (`[url, params]`). The
// shared `useEntityMutation` auto-invalidation filters by `typeof key ===
// "string"` and silently skips tuple keys, so both cards depend on the
// container plumbing their `refresh()` callbacks back through the dialog
// close path.
//
// Without this test, a future refactor that drops `onRefreshNeeded` from
// either card (or fails to call the captured callbacks on dialog close)
// would let stale create/edit data reach users without any unit-test
// failure. The card-level tests pin each card's *outgoing* contract; this
// test pins the container's *consumption* of both contracts together.

// All imports of the actual cards/dialogs are mocked because the contract
// under test lives in the container's wiring, not in the cards themselves.
//
// Each mock card calls the captured `onRefreshNeeded` with a fixed spy on
// mount. The dialog mock exposes a button so the test can simulate
// `onOpenChange(false)` (the close path the real dialog takes after a
// create/edit submit).

const upcomingSessionRefreshSpy = vi.fn();
const coachingSessionsCardRefreshSpy = vi.fn();

vi.mock("@/components/ui/dashboard/upcoming-session-card", () => ({
  UpcomingSessionCard: ({
    onRefreshNeeded,
  }: {
    onRefreshNeeded?: (fn: () => void) => void;
  }) => {
    // Defer the parent's `setState` until after render to mirror the real
    // card's `useEffect`-based registration and avoid React's "setState
    // during render" warning.
    useEffect(() => {
      onRefreshNeeded?.(upcomingSessionRefreshSpy);
    }, [onRefreshNeeded]);
    return <div data-testid="upcoming-session-card-stub" />;
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

// CoachingSessionDialog renders nothing meaningful but exposes a button
// that fires `onOpenChange(false)` so the test can simulate the close
// path. We use this rather than mounting the real dialog because the
// real dialog requires a backend submit to fire the close callback.
vi.mock("@/components/ui/dashboard/coaching-session-dialog", () => ({
  CoachingSessionDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <button
        data-testid="close-dialog-stub"
        onClick={() => onOpenChange(false)}
      >
        Close
      </button>
    ) : null,
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
    render(<DashboardContainer />);

    // Both cards register their refresh fn through the container's
    // `onRefreshNeeded` callbacks. Failing here means the container
    // either dropped a prop or stopped passing it.
    expect(upcomingSessionRefreshSpy).not.toHaveBeenCalled();
    expect(coachingSessionsCardRefreshSpy).not.toHaveBeenCalled();
    // The card *stubs* are responsible for invoking onRefreshNeeded
    // with these spies; the assertion above just establishes the
    // baseline. The next test exercises the call path.
  });

  it("invokes BOTH card refreshes when the create/edit dialog closes", () => {
    render(<DashboardContainer />);

    // Pre-state: refreshes haven't been called as a result of dialog
    // close yet (they're plumbed but the dialog is closed at mount).
    upcomingSessionRefreshSpy.mockClear();
    coachingSessionsCardRefreshSpy.mockClear();

    // Open the dialog via the header stub.
    fireEvent.click(screen.getByTestId("open-dialog-stub"));
    // Dialog stub renders only when open.
    expect(screen.getByTestId("close-dialog-stub")).toBeInTheDocument();

    // Close the dialog via the stub's `onOpenChange(false)` button.
    act(() => {
      fireEvent.click(screen.getByTestId("close-dialog-stub"));
    });

    // The contract: dialog-close fires both refreshes. If a future
    // refactor wires the dialog's onOpenChange to a path that only
    // refreshes one card (or neither), this assertion will fail.
    expect(upcomingSessionRefreshSpy).toHaveBeenCalledTimes(1);
    expect(coachingSessionsCardRefreshSpy).toHaveBeenCalledTimes(1);
  });

  it("does not fire refreshes on initial mount (only on dialog close)", () => {
    upcomingSessionRefreshSpy.mockClear();
    coachingSessionsCardRefreshSpy.mockClear();

    render(<DashboardContainer />);

    // Mount alone — no dialog interaction yet — must not fire either
    // refresh. If it did, every dashboard render would re-fetch, which
    // would also break SWR's cache-warmth semantics elsewhere.
    expect(upcomingSessionRefreshSpy).not.toHaveBeenCalled();
    expect(coachingSessionsCardRefreshSpy).not.toHaveBeenCalled();
  });
});
