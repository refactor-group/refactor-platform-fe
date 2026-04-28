import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { CoachingSessionsCard } from "@/components/ui/dashboard/coaching-sessions-card";
import { ItemStatus } from "@/types/general";
import { Some } from "@/types/option";
import {
  createMockAction,
  createMockEnrichedSession,
} from "../../../test-utils";
import type { EnrichedCoachingSession } from "@/types/coaching-session";

// ── Hook mocks ───────────────────────────────────────────────────────────

const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

// The card calls `useEnrichedCoachingSessionsForUser` twice — once with
// `sortOrder: "asc"` (upcoming) and once with `"desc"` (previous). The mock
// dispatches by sortOrder so each call gets its own dataset.
const mockUseEnrichedCoachingSessionsForUser = vi.fn();
vi.mock("@/lib/api/coaching-sessions", () => ({
  useEnrichedCoachingSessionsForUser: (
    _userId: unknown,
    _from: unknown,
    _to: unknown,
    _include: unknown,
    _sortBy: unknown,
    sortOrder: "asc" | "desc"
  ) => mockUseEnrichedCoachingSessionsForUser(sortOrder),
}));

const mockUseUserActionsList = vi.fn();
vi.mock("@/lib/api/user-actions", () => ({
  useUserActionsList: () => mockUseUserActionsList(),
}));

// Filter dropdown dependencies — stable defaults for all tests.
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));

vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => ({ relationships: [] }),
}));

// ── Setup helpers ────────────────────────────────────────────────────────

const COACH_USER = { id: "coach-1", timezone: "UTC" };

function setupBaseAuth(user = COACH_USER) {
  mockAuthStore.mockReturnValue({ userSession: user, isACoach: true });
  mockUseUserActionsList.mockReturnValue({
    actions: [],
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  });
}

interface WindowMocks {
  upcoming?: Partial<{
    enrichedSessions: EnrichedCoachingSession[];
    isLoading: boolean;
    isError: unknown;
  }>;
  previous?: Partial<{
    enrichedSessions: EnrichedCoachingSession[];
    isLoading: boolean;
    isError: unknown;
  }>;
}

/** Configure the dual `useEnrichedCoachingSessionsForUser` calls. */
function setupSessionWindows({ upcoming, previous }: WindowMocks = {}) {
  const baseUpcoming = {
    enrichedSessions: [],
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  };
  const basePrevious = { ...baseUpcoming };
  mockUseEnrichedCoachingSessionsForUser.mockImplementation(
    (sortOrder: "asc" | "desc") =>
      sortOrder === "asc"
        ? { ...baseUpcoming, ...upcoming }
        : { ...basePrevious, ...previous }
  );
}

const FAR_PAST = "2020-02-15T14:00:00Z";
const FAR_FUTURE = "2099-03-15T14:00:00Z";

// ── Tests ────────────────────────────────────────────────────────────────

describe("CoachingSessionsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the loading state while either window is fetching", () => {
    setupBaseAuth();
    setupSessionWindows({ upcoming: { isLoading: true } });

    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    expect(
      screen.getByText(/loading your coaching sessions/i)
    ).toBeInTheDocument();
  });

  it("renders the error state when either window fails", () => {
    setupBaseAuth();
    setupSessionWindows({ previous: { isError: new Error("boom") } });

    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    expect(
      screen.getByText(/couldn't load your coaching sessions/i)
    ).toBeInTheDocument();
  });

  it("renders per-tab empty messages when both windows are empty", () => {
    setupBaseAuth();
    setupSessionWindows();
    render(<CoachingSessionsCard onReschedule={vi.fn()} />);
    expect(screen.getByText(/no upcoming sessions/i)).toBeInTheDocument();
  });

  it("places the upcoming-window sessions in Upcoming and previous-window sessions in Previous", async () => {
    const user = userEvent.setup();
    setupBaseAuth();

    setupSessionWindows({
      upcoming: {
        enrichedSessions: [
          createMockEnrichedSession({ id: "s-future", date: FAR_FUTURE }),
        ],
      },
      previous: {
        enrichedSessions: [
          createMockEnrichedSession({ id: "s-past", date: FAR_PAST }),
        ],
      },
    });

    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    expect(screen.getByTestId("session-row-s-future")).toBeInTheDocument();
    expect(screen.queryByTestId("session-row-s-past")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /previous/i }));
    expect(screen.getByTestId("session-row-s-past")).toBeInTheDocument();
    expect(screen.queryByTestId("session-row-s-future")).not.toBeInTheDocument();
  });

  it("shows Reschedule on upcoming rows for a coach viewer and fires the callback", () => {
    const onReschedule = vi.fn();
    setupBaseAuth({ id: "coach-1", timezone: "UTC" });

    const session = createMockEnrichedSession({ id: "s1", date: FAR_FUTURE });
    setupSessionWindows({ upcoming: { enrichedSessions: [session] } });

    render(<CoachingSessionsCard onReschedule={onReschedule} />);

    const row = screen.getByTestId("session-row-s1");
    fireEvent.click(within(row).getByRole("button", { name: /reschedule/i }));
    expect(onReschedule).toHaveBeenCalledWith(session);
  });

  it("hides Reschedule on upcoming rows when viewer is the coachee", () => {
    setupBaseAuth({ id: "coachee-1", timezone: "UTC" });

    const session = createMockEnrichedSession({ id: "s1", date: FAR_FUTURE });
    setupSessionWindows({ upcoming: { enrichedSessions: [session] } });

    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    const row = screen.getByTestId("session-row-s1");
    expect(
      within(row).queryByRole("button", { name: /reschedule/i })
    ).not.toBeInTheDocument();
    // Two Join links rendered: one desktop (hover-revealed), one mobile-only.
    // Both must point at the same coaching session detail route.
    const links = within(row).getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/coaching-sessions/s1");
    }
  });

  it("renders the View link instead of Join on the Previous tab", async () => {
    const user = userEvent.setup();
    setupBaseAuth();

    const session = createMockEnrichedSession({ id: "s-past", date: FAR_PAST });
    setupSessionWindows({ previous: { enrichedSessions: [session] } });

    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /previous/i }));
    const row = screen.getByTestId("session-row-s-past");
    expect(
      within(row).queryByRole("button", { name: /reschedule/i })
    ).not.toBeInTheDocument();
    const viewButtons = within(row).getAllByRole("button", { name: /view/i });
    expect(viewButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows the empty hover-detail panel before any row is hovered", () => {
    setupBaseAuth();
    setupSessionWindows({
      upcoming: {
        enrichedSessions: [
          createMockEnrichedSession({ id: "s1", date: FAR_FUTURE }),
        ],
      },
    });

    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    expect(
      screen.getByText(/hover over a session to see actions due/i)
    ).toBeInTheDocument();
  });

  it("populates the hover-detail panel with goals and actions due for the hovered session", () => {
    setupBaseAuth();

    const past = createMockEnrichedSession({
      id: "s-prev",
      date: "2099-02-15T14:00:00Z",
    });
    const upcoming = createMockEnrichedSession({
      id: "s-current",
      date: "2099-03-15T14:00:00Z",
      goals: [
        {
          id: "g1",
          title: "Improve technical leadership",
          body: "",
          status: ItemStatus.InProgress,
          coaching_relationship_id: "rel-1",
          created_in_session_id: null,
          target_date: null,
          status_changed_at: DateTime.now(),
          completed_at: null,
          created_at: DateTime.now(),
          updated_at: DateTime.now(),
        },
      ],
    });

    setupSessionWindows({
      upcoming: { enrichedSessions: [upcoming] },
      previous: { enrichedSessions: [past] },
    });

    const actionDue = createMockAction({
      id: "a1",
      coaching_session_id: "s-prev",
      body: "Lead next sprint planning meeting",
      goal_id: Some("g1"),
      status: ItemStatus.InProgress,
      due_by: DateTime.fromISO("2099-02-28T12:00:00Z"),
    });
    mockUseUserActionsList.mockReturnValue({
      actions: [actionDue],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    fireEvent.mouseEnter(screen.getByTestId("session-row-s-current"));

    expect(screen.getByText(/session with alex chen/i)).toBeInTheDocument();
    expect(screen.getByText("Improve technical leadership")).toBeInTheDocument();
    expect(
      screen.getByText("Lead next sprint planning meeting")
    ).toBeInTheDocument();
  });

  it("places a disabled Clock toggle button alongside the active List button", () => {
    setupBaseAuth();
    setupSessionWindows();
    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    expect(screen.getByRole("button", { name: /list view/i })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /timeline view/i })
    ).toBeDisabled();
  });

  it("renders a Filters trigger that opens a popover with Time window and Relationship controls", async () => {
    const user = userEvent.setup();
    setupBaseAuth();
    setupSessionWindows();

    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    const filtersBtn = screen.getByRole("button", { name: /filters/i });
    expect(filtersBtn).toBeInTheDocument();

    await user.click(filtersBtn);

    expect(
      screen.getByRole("combobox", { name: /time window/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /relationship filter/i })
    ).toBeInTheDocument();
  });
});
