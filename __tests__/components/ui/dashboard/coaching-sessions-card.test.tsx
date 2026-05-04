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
import { SessionTimeWindow } from "@/components/ui/dashboard/coaching-sessions-filters";

// ── Hook mocks ───────────────────────────────────────────────────────────

const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

// Sticky filter store — backed by a vi.fn so each test can override the
// initial timeWindow / relationshipFilter values, and so we can spy on the
// setter calls to verify the stale-filter cleanup effect.
const mockSetTimeWindow = vi.fn();
const mockSetRelationshipFilter = vi.fn();
const mockFilterStore = vi.fn();
vi.mock(
  "@/lib/providers/coaching-sessions-card-filter-store-provider",
  () => ({
    useCoachingSessionsCardFilterStore: (
      selector: (state: unknown) => unknown
    ) => selector(mockFilterStore()),
  })
);

// The card issues a single `useEnrichedCoachingSessionsForUser` call over
// `[now − window, now + window]` and partitions client-side at timestamp
// precision. The mock returns one combined dataset; tests that distinguish
// "upcoming" vs "previous" rely on `session.date` relative to `now`.
const mockUseEnrichedCoachingSessionsForUser = vi.fn();
vi.mock("@/lib/api/coaching-sessions", () => ({
  useEnrichedCoachingSessionsForUser: () =>
    mockUseEnrichedCoachingSessionsForUser(),
}));

// Forward args so tests can assert the call was scoped by the hovered
// session's `coaching_relationship_id` — the architectural defense against
// the cross-relationship actions leakage bug.
const mockUseUserActionsList = vi.fn();
vi.mock("@/lib/api/user-actions", () => ({
  useUserActionsList: (...args: unknown[]) => mockUseUserActionsList(...args),
}));

// Filter dropdown dependencies — stable defaults for all tests.
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));

// `useCoachingRelationshipList` returns `{ relationships, isLoading }`. The
// card's stale-filter cleanup effect gates on `isLoading`, so tests that
// exercise that effect override this mock per-case via mockUseCoachingRelationshipList.
const mockUseCoachingRelationshipList = vi.fn();
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => mockUseCoachingRelationshipList(),
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

interface FilterStoreOverrides {
  timeWindow?: SessionTimeWindow;
  relationshipFilter?: string;
}

/** Configure the sticky filter store with the given persisted values. */
function setupFilterStore(overrides: FilterStoreOverrides = {}) {
  mockFilterStore.mockReturnValue({
    timeWindow: overrides.timeWindow ?? SessionTimeWindow.Day,
    relationshipFilter: overrides.relationshipFilter,
    setTimeWindow: mockSetTimeWindow,
    setRelationshipFilter: mockSetRelationshipFilter,
    resetCoachingSessionsCardFilters: vi.fn(),
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

/**
 * Configure the single `useEnrichedCoachingSessionsForUser` call. The
 * `upcoming` / `previous` field names are kept for test ergonomics — the
 * sessions are merged into one dataset and the card partitions them
 * client-side based on `session.date` vs `now`. Tests should use
 * unambiguously-past dates (e.g. 2020) for `previous` and unambiguously-future
 * dates (e.g. 2099) for `upcoming` so the partition is deterministic.
 */
function setupSessionWindows({ upcoming, previous }: WindowMocks = {}) {
  const enrichedSessions = [
    ...(previous?.enrichedSessions ?? []),
    ...(upcoming?.enrichedSessions ?? []),
  ];
  mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
    enrichedSessions,
    isLoading: !!(upcoming?.isLoading || previous?.isLoading),
    isError: upcoming?.isError ?? previous?.isError,
    refresh: vi.fn(),
  });
}

const FAR_PAST = "2020-02-15T14:00:00Z";
const FAR_FUTURE = "2099-03-15T14:00:00Z";

// ── Tests ────────────────────────────────────────────────────────────────

describe("CoachingSessionsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default sticky-filter store: empty filter, default time range. Tests
    // exercising stickiness/cleanup override these via setupFilterStore.
    setupFilterStore();
    // Default: relationship list loaded with no relationships. Tests
    // exercising the stale-filter cleanup effect override this.
    mockUseCoachingRelationshipList.mockReturnValue({
      relationships: [],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
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

  it("renders a Filters trigger that opens a popover with Time Range and Relationship controls", async () => {
    const user = userEvent.setup();
    setupBaseAuth();
    setupSessionWindows();

    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    const filtersBtn = screen.getByRole("button", { name: /filters/i });
    expect(filtersBtn).toBeInTheDocument();

    await user.click(filtersBtn);

    expect(
      screen.getByRole("combobox", { name: /time range/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /relationship filter/i })
    ).toBeInTheDocument();
  });

  // ── Hover preview — actions fetch is scoped by hovered relationship ────
  //
  // Pins the architectural fix for the bug where Bob's previous-session
  // hover surfaced actions assigned in Levi's and Caleb's sessions: the
  // dashboard now fetches actions scoped at the API layer by the hovered
  // session's `coaching_relationship_id`, mirroring `usePanelActions::
  // useReviewWindow`. A regression that re-introduces a cross-relationship
  // fetch (or post-filter) would break this assertion.
  describe("hover-keyed actions fetch scoping", () => {
    it("scopes the actions fetch by the hovered session's coaching_relationship_id when no relationship filter is set", async () => {
      const user = userEvent.setup();
      setupBaseAuth();
      const session = createMockEnrichedSession({
        id: "s-bob-prev",
        date: FAR_PAST,
        coaching_relationship_id: "rel-bob",
      });
      setupSessionWindows({ previous: { enrichedSessions: [session] } });

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      // Move to Previous tab (where the seeded session lives) and hover it.
      await user.click(screen.getByRole("tab", { name: /previous/i }));
      fireEvent.mouseEnter(screen.getByTestId("session-row-s-bob-prev"));

      // The MOST RECENT call must scope to Bob's relationship — even though
      // earlier calls during pre-hover renders may have skipped the fetch
      // (userId=null) when no filter and nothing hovered.
      const lastCall =
        mockUseUserActionsList.mock.calls[
          mockUseUserActionsList.mock.calls.length - 1
        ];
      expect(lastCall[0]).toBe(COACH_USER.id);
      expect(lastCall[1]).toMatchObject({
        coaching_relationship_id: "rel-bob",
      });
    });

    it("skips the actions fetch entirely when no relationship filter is set and nothing is hovered", () => {
      setupBaseAuth();
      setupSessionWindows();

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      // No hover → no relationship to scope by → fetch is skipped (userId=null).
      // Don't assert "all calls" — other code paths may make their own
      // useUserActionsList calls; just verify no scoped call ran.
      const scopedCalls = mockUseUserActionsList.mock.calls.filter(
        (args) => args[0] !== null
      );
      expect(scopedCalls).toHaveLength(0);
    });
  });

  // ── Sticky filter — stale-relationship cleanup effect ──────────────────
  //
  // The card persists `relationshipFilter` across navigations via
  // `useCoachingSessionsCardFilterStore` (sessionStorage). On mount it
  // reconciles the persisted id against the freshly-loaded relationships:
  // if the id no longer resolves to a real option (org switch, removed
  // relationship), it must clear the filter so the user doesn't see an
  // empty session list with no visible cause. The cleanup must NOT fire
  // before the relationship list has loaded — `useEntityList` returns
  // `entities` defaulted to an empty array (not undefined), so a naive
  // truthiness check would clear a valid persisted filter on every mount.
  describe("sticky relationship filter cleanup", () => {
    const STALE_REL_ID = "rel-no-longer-exists";
    const VALID_REL_ID = "rel-1";

    function relationshipsWithUser(ids: string[]) {
      return ids.map((id) => ({
        id,
        organization_id: "org-1",
        coach_id: COACH_USER.id,
        coachee_id: `coachee-${id}`,
        coach_first_name: "Coach",
        coach_last_name: "User",
        coachee_first_name: "Coachee",
        coachee_last_name: id.toUpperCase(),
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }));
    }

    it("clears persisted relationshipFilter when it does not resolve to a loaded relationship", () => {
      setupBaseAuth();
      setupSessionWindows();
      setupFilterStore({ relationshipFilter: STALE_REL_ID });
      mockUseCoachingRelationshipList.mockReturnValue({
        relationships: relationshipsWithUser([VALID_REL_ID]),
        isLoading: false,
        isError: undefined,
        refresh: vi.fn(),
      });

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      expect(mockSetRelationshipFilter).toHaveBeenCalledWith(undefined);
    });

    it("preserves persisted relationshipFilter when it does resolve to a loaded relationship", () => {
      setupBaseAuth();
      setupSessionWindows();
      setupFilterStore({ relationshipFilter: VALID_REL_ID });
      mockUseCoachingRelationshipList.mockReturnValue({
        relationships: relationshipsWithUser([VALID_REL_ID, "rel-2"]),
        isLoading: false,
        isError: undefined,
        refresh: vi.fn(),
      });

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      expect(mockSetRelationshipFilter).not.toHaveBeenCalled();
    });

    it("does not clear the persisted relationshipFilter while the relationship list is still loading", () => {
      setupBaseAuth();
      setupSessionWindows();
      setupFilterStore({ relationshipFilter: VALID_REL_ID });
      // Loading state: `useEntityList` returns the EMPTY_ARRAY sentinel even
      // mid-fetch, so isLoading=true is the only honest "not yet loaded"
      // signal. The cleanup effect must respect it.
      mockUseCoachingRelationshipList.mockReturnValue({
        relationships: [],
        isLoading: true,
        isError: undefined,
        refresh: vi.fn(),
      });

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      expect(mockSetRelationshipFilter).not.toHaveBeenCalled();
    });
  });
});
