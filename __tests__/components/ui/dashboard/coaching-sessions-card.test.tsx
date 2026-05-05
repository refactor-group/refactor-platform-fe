import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DateTime,
  FixedOffsetZone,
  Settings as LuxonSettings,
  type Zone,
} from "ts-luxon";
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
// Delete-flow plumbing: `useCoachingSessionMutation` exposes `delete`. We
// expose a fresh `mockDelete` per test so assertions on call args /
// rejection paths stay isolated.
const mockDelete = vi.fn();
vi.mock("@/lib/api/coaching-sessions", () => ({
  useEnrichedCoachingSessionsForUser: () =>
    mockUseEnrichedCoachingSessionsForUser(),
  useCoachingSessionMutation: () => ({ delete: mockDelete }),
}));

// Sonner is mounted globally in app/layout but isn't rendered in unit
// tests, so we mock the module surface and assert the toast calls
// directly. Only `error` is used today — successful deletes communicate
// via the row disappearing, not a toast.
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// The Share link kebab item routes through `copyCoachingSessionLink-
// WithToast`. Mock the whole module so we can assert the right session
// id was sent to it without exercising the real clipboard write path.
const mockCopyLink = vi.fn();
vi.mock("@/components/ui/share-session-link", () => ({
  copyCoachingSessionLinkWithToast: (id: string) => mockCopyLink(id),
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
    // Mirrors the production default (Week) so tests share the same baseline
    // the user actually sees on first load. Override per-test as needed.
    timeWindow: overrides.timeWindow ?? SessionTimeWindow.Week,
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
// Captured at module scope so the delete-flow test can assert that the
// card calls the hook's `refresh()` after a successful delete — that's
// the load-bearing wiring (the entity-mutation auto-invalidate doesn't
// fire because the user-scoped fetch uses a different cache key).
const mockSessionsRefresh = vi.fn();

function setupSessionWindows({ upcoming, previous }: WindowMocks = {}) {
  const enrichedSessions = [
    ...(previous?.enrichedSessions ?? []),
    ...(upcoming?.enrichedSessions ?? []),
  ];
  mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
    enrichedSessions,
    isLoading: !!(upcoming?.isLoading || previous?.isLoading),
    isError: upcoming?.isError ?? previous?.isError,
    refresh: mockSessionsRefresh,
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

  // Notes on partition behavior NOT directly asserted below — coverage gaps
  // worth re-considering if the helper is rewritten:
  //
  //   - `now` is captured at mount AND ticks every 60s in the card itself.
  //     A session crossing the boundary while the dashboard sits open
  //     migrates Upcoming → Previous within ≤ 60s. Asserting this would
  //     require fake timers + advancing past 60s; the cost-to-signal of
  //     simulating a real-time tick exceeds its value here.
  //   - The partition parses `session.date` with `{ zone: "utc" }` because
  //     the backend ships naive ISO datetime strings; without that, sessions
  //     near `now` would partition into the wrong tab in non-UTC viewer
  //     zones. Reproducing that bug deterministically requires controlling
  //     `process.env.TZ` at vitest startup, which the current test infra
  //     doesn't gate per-file.
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

  it("shows Reschedule for a coach viewer inside the row's kebab menu and fires the callback", async () => {
    const user = userEvent.setup();
    const onReschedule = vi.fn();
    setupBaseAuth({ id: "coach-1", timezone: "UTC" });

    const session = createMockEnrichedSession({ id: "s1", date: FAR_FUTURE });
    setupSessionWindows({ upcoming: { enrichedSessions: [session] } });

    render(<CoachingSessionsCard onReschedule={onReschedule} />);

    const row = screen.getByTestId("session-row-s1");
    // Reschedule lives inside the kebab dropdown — must open it first.
    await user.click(within(row).getByRole("button", { name: /session actions/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /reschedule/i })
    );
    expect(onReschedule).toHaveBeenCalledWith(session);
  });

  it("renders a kebab on coachee rows but limits it to Share link (no Reschedule, no Delete)", async () => {
    const user = userEvent.setup();
    setupBaseAuth({ id: "coachee-1", timezone: "UTC" });

    const session = createMockEnrichedSession({ id: "s1", date: FAR_FUTURE });
    setupSessionWindows({ upcoming: { enrichedSessions: [session] } });

    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    const row = screen.getByTestId("session-row-s1");
    // The Join link still renders so coachees can navigate. Asserted
    // BEFORE opening the menu — Radix's DropdownMenu marks the rest of
    // the page `aria-hidden` while open, so `getAllByRole("link")`
    // returns nothing if queried after the menu trigger fires.
    const links = within(row).getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/coaching-sessions/s1");
    }

    // Share link is available to any viewer, so the kebab itself stays
    // present even for coachees — but the menu must NOT expose the
    // coach-only actions.
    await user.click(within(row).getByRole("button", { name: /session actions/i }));
    expect(
      screen.queryByRole("menuitem", { name: /reschedule/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /delete session/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /share link/i })
    ).toBeInTheDocument();
  });

  it("renders the View link instead of Join on the Previous tab and offers Delete in the kebab", async () => {
    const user = userEvent.setup();
    setupBaseAuth();

    const session = createMockEnrichedSession({ id: "s-past", date: FAR_PAST });
    setupSessionWindows({ previous: { enrichedSessions: [session] } });

    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /previous/i }));
    const row = screen.getByTestId("session-row-s-past");
    const viewButtons = within(row).getAllByRole("button", { name: /view/i });
    expect(viewButtons.length).toBeGreaterThanOrEqual(1);

    // Past sessions: no Reschedule, but Delete is still available to the
    // coach. Open the kebab to assert both invariants.
    await user.click(within(row).getByRole("button", { name: /session actions/i }));
    expect(
      screen.queryByRole("menuitem", { name: /reschedule/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /delete session/i })
    ).toBeInTheDocument();
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

  // ── Delete flow ──────────────────────────────────────────────────────
  //
  // Covers the kebab-menu → AlertDialog → mutation pipeline. The card owns
  // the dialog state (single instance for all rows) and the mutation, so
  // every assertion in this block targets the card's externally-visible
  // contract: which menu items are reachable, what copy the dialog shows,
  // which API the confirm button drives, and which toasts fire on
  // success/failure.
  describe("delete flow", () => {
    it("opens the confirmation dialog with the unified copy when Delete is clicked on an upcoming row", async () => {
      const user = userEvent.setup();
      setupBaseAuth();

      const session = createMockEnrichedSession({
        id: "s-upcoming",
        date: FAR_FUTURE,
      });
      setupSessionWindows({ upcoming: { enrichedSessions: [session] } });

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      await user.click(
        within(screen.getByTestId("session-row-s-upcoming")).getByRole("button", {
          name: /session actions/i,
        })
      );
      await user.click(
        await screen.findByRole("menuitem", { name: /delete session/i })
      );

      expect(
        screen.getByRole("alertdialog", {
          name: /delete this coaching session/i,
        })
      ).toBeInTheDocument();
      // The dialog uses unified copy regardless of tab — it always names
      // the cascading loss. For upcoming sessions this is informational
      // (none yet); for previous sessions it's load-bearing.
      expect(
        screen.getByText(/notes and completed actions/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^delete session$/i })
      ).toBeInTheDocument();
    });

    it("opens the same unified dialog on previous rows", async () => {
      const user = userEvent.setup();
      setupBaseAuth();

      const session = createMockEnrichedSession({
        id: "s-past",
        date: FAR_PAST,
      });
      setupSessionWindows({ previous: { enrichedSessions: [session] } });

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      await user.click(screen.getByRole("tab", { name: /previous/i }));
      await user.click(
        within(screen.getByTestId("session-row-s-past")).getByRole("button", {
          name: /session actions/i,
        })
      );
      await user.click(
        await screen.findByRole("menuitem", { name: /delete session/i })
      );

      // Same copy, both tabs. Pinning that the unification didn't quietly
      // re-introduce a tab-keyed branch.
      expect(
        screen.getByText(/notes and completed actions/i)
      ).toBeInTheDocument();
    });

    it("does not call the delete API when Cancel is clicked", async () => {
      const user = userEvent.setup();
      setupBaseAuth();

      const session = createMockEnrichedSession({
        id: "s1",
        date: FAR_FUTURE,
      });
      setupSessionWindows({ upcoming: { enrichedSessions: [session] } });

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      await user.click(
        within(screen.getByTestId("session-row-s1")).getByRole("button", {
          name: /session actions/i,
        })
      );
      await user.click(
        await screen.findByRole("menuitem", { name: /delete session/i })
      );
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("calls the delete mutation, refreshes the session list, and closes the dialog when confirmed", async () => {
      const user = userEvent.setup();
      setupBaseAuth();
      mockDelete.mockResolvedValueOnce(undefined);

      const session = createMockEnrichedSession({
        id: "s-doomed",
        date: FAR_FUTURE,
      });
      setupSessionWindows({ upcoming: { enrichedSessions: [session] } });

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      await user.click(
        within(screen.getByTestId("session-row-s-doomed")).getByRole(
          "button",
          { name: /session actions/i }
        )
      );
      await user.click(
        await screen.findByRole("menuitem", { name: /delete session/i })
      );
      await user.click(
        screen.getByRole("button", { name: /^delete session$/i })
      );

      expect(mockDelete).toHaveBeenCalledWith("s-doomed");
      // Pinning the bug found during browser verification: the entity-
      // mutation auto-invalidate matches keys by entity baseUrl
      // (`coaching_sessions/`), but the dashboard fetches via the
      // user-scoped enriched endpoint, whose cache key doesn't match.
      // Without an explicit `refresh()` call, the deleted row would
      // linger until a hard reload.
      expect(mockSessionsRefresh).toHaveBeenCalled();
      // Dialog should be gone after a successful confirm.
      expect(
        screen.queryByRole("alertdialog", {
          name: /delete this coaching session/i,
        })
      ).not.toBeInTheDocument();
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("fires the error toast and closes the dialog when the delete mutation rejects", async () => {
      const user = userEvent.setup();
      setupBaseAuth();
      mockDelete.mockRejectedValueOnce(new Error("API down"));

      const session = createMockEnrichedSession({
        id: "s-fail",
        date: FAR_FUTURE,
      });
      setupSessionWindows({ upcoming: { enrichedSessions: [session] } });

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      await user.click(
        within(screen.getByTestId("session-row-s-fail")).getByRole("button", {
          name: /session actions/i,
        })
      );
      await user.click(
        await screen.findByRole("menuitem", { name: /delete session/i })
      );
      await user.click(
        screen.getByRole("button", { name: /^delete session$/i })
      );

      expect(mockDelete).toHaveBeenCalledWith("s-fail");
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to delete session",
        expect.objectContaining({ description: "API down" })
      );
      // No success toast exists — only the error path surfaces a toast.
      // The dialog still closes after a failure — the user sees the error
      // toast and can retry from the row.
      expect(
        screen.queryByRole("alertdialog", {
          name: /delete this coaching session/i,
        })
      ).not.toBeInTheDocument();
    });

    it("does not expose Delete in the kebab when the viewer is a coachee", async () => {
      const user = userEvent.setup();
      setupBaseAuth({ id: "coachee-1", timezone: "UTC" });

      // Relationship has coach-1 as coach, so coachee-1 is the coachee.
      const session = createMockEnrichedSession({
        id: "s1",
        date: FAR_FUTURE,
      });
      setupSessionWindows({ upcoming: { enrichedSessions: [session] } });

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      const row = screen.getByTestId("session-row-s1");
      // Coachee gets a kebab (Share link is universal) but the menu must
      // NOT expose Delete — that's the contract this test pins. Open the
      // kebab and assert the menu surface explicitly.
      await user.click(
        within(row).getByRole("button", { name: /session actions/i })
      );
      expect(
        screen.queryByRole("menuitem", { name: /delete session/i })
      ).not.toBeInTheDocument();

      // Sanity: confirm `mockDelete` is never reachable from this row.
      expect(mockDelete).not.toHaveBeenCalled();
    });

    // ── Card-side half of the auto-refresh contract ───────────────────────
    //
    // The dashboard relies on `onRefreshNeeded` to plumb the user-scoped
    // SWR fetch's `refresh()` up to `DashboardContainer` so it can fire
    // after the create/edit dialog closes. This bypasses the bug in
    // `useEntityMutation`'s auto-invalidation, which filters by
    // `typeof key === "string"` and silently skips tuple-keyed
    // `useEntityList` caches like ours. If a future refactor changes the
    // hook surface or accidentally drops the prop, the create flow will
    // start showing stale data without any unit-test failure — unless
    // this test catches it.
    it("surfaces a stable wrapper via onRefreshNeeded that delegates to the hook's refresh", () => {
      setupBaseAuth();
      setupSessionWindows();
      const handleRefreshNeeded = vi.fn();

      render(
        <CoachingSessionsCard
          onReschedule={vi.fn()}
          onRefreshNeeded={handleRefreshNeeded}
        />
      );

      // The card passes a *wrapper* closure that delegates to whatever
      // `refreshSessions` is current at call time — keeps the parent's
      // stored callback identity-stable. We can't assert
      // `toHaveBeenCalledWith(mockSessionsRefresh)` because they aren't
      // the same function reference. Instead: assert one registration,
      // grab the wrapper, invoke it, and verify it routed to the spy.
      expect(handleRefreshNeeded).toHaveBeenCalledTimes(1);
      const wrapper = handleRefreshNeeded.mock.calls[0][0] as () => void;
      expect(typeof wrapper).toBe("function");
      wrapper();
      expect(mockSessionsRefresh).toHaveBeenCalledTimes(1);
    });
  });

  // ── Date-range chip + dropdown date hints ─────────────────────────────
  //
  // The header chip shows the *resolved* calendar range (e.g.
  // "Apr 27 – May 11") instead of the abstract "1 week". The dropdown
  // options also stack the resolved range under the abstract size so the
  // user previews "what would I get?" before selecting. Both share the
  // same anchor (`mountNow`) so chip text and dropdown previews always
  // agree with the data fetch.
  //
  // Tests below pin a fixed system time so the resolved ranges are
  // deterministic. Without this, expected strings would drift with the
  // wall clock.
  describe("date-range display in chip and dropdown", () => {
    // 2026-05-04 noon UTC — anchored so the 1-week half-span (±3.5d) lands
    // entirely within the same year (no year-crossing edge case).
    const FIXED_NOW = new Date("2026-05-04T12:00:00Z");
    // Pin luxon to UTC for these assertions. The chip uses
    // `DateTime.now()`, which respects the local zone — without this the
    // expected strings would shift between dev machines and CI depending
    // on `TZ`. The unit tests for `formatTimeWindowDateRange` already
    // pass an explicit UTC anchor, so they're insulated from this.
    let originalDefaultZone: Zone;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);
      originalDefaultZone = LuxonSettings.defaultZone;
      LuxonSettings.defaultZone = FixedOffsetZone.utcInstance;
    });

    afterEach(() => {
      vi.useRealTimers();
      LuxonSettings.defaultZone = originalDefaultZone;
    });

    it("shows the resolved date range in the chip instead of the abstract size", () => {
      setupBaseAuth();
      setupSessionWindows();
      // 1 week against May 4 noon → ±3.5d → May 1 – May 8.
      setupFilterStore({ timeWindow: SessionTimeWindow.Week });

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      // Chip should show the resolved dates, NOT the abstract label.
      expect(screen.getByText(/May 1 – May 8/)).toBeInTheDocument();
      expect(screen.queryByText("1 week")).not.toBeInTheDocument();
    });

    it("recomputes the chip range when a different window size is selected", () => {
      setupBaseAuth();
      setupSessionWindows();
      // 1 day against May 4 noon → ±12h → May 4 – May 5.
      setupFilterStore({ timeWindow: SessionTimeWindow.Day });

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      expect(screen.getByText(/May 4 – May 5/)).toBeInTheDocument();
    });

    // Note: the dropdown options stack the resolved range as a secondary
    // line under each abstract label. Driving the Radix Select open in
    // JSDOM under fake timers reliably times out (Radix waits for animation
    // frames the test harness can't advance). The wiring is covered by:
    //   - The `formatTimeWindowDateRange` unit tests (filters helper)
    //   - The chip integration tests above (same anchor + helper)
    // If a future regression silently strips the secondary line, both the
    // helper output and the chip would be unaffected — at that point a
    // focused header/popover render test would be worth adding. Today the
    // cost-to-signal of fighting Radix-in-JSDOM exceeds its value.
  });

  // ── Share link kebab item ─────────────────────────────────────────────
  //
  // Restored from the legacy CoachingSessionList. Universal action — any
  // viewer (coach or coachee), any tab (upcoming or previous). Routes
  // through the existing `copyCoachingSessionLinkWithToast` utility so
  // the success/error toasts come for free.
  describe("share link", () => {
    it("invokes the copy utility with the session id when Share link is clicked", async () => {
      const user = userEvent.setup();
      setupBaseAuth();
      const session = createMockEnrichedSession({
        id: "s-share",
        date: FAR_FUTURE,
      });
      setupSessionWindows({ upcoming: { enrichedSessions: [session] } });

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      const row = screen.getByTestId("session-row-s-share");
      await user.click(within(row).getByRole("button", { name: /session actions/i }));
      await user.click(
        await screen.findByRole("menuitem", { name: /share link/i })
      );

      expect(mockCopyLink).toHaveBeenCalledTimes(1);
      expect(mockCopyLink).toHaveBeenCalledWith("s-share");
    });

    it("exposes Share link to coachees as well (universal action)", async () => {
      const user = userEvent.setup();
      // Coachee viewer — has no Reschedule and no Delete.
      setupBaseAuth({ id: "coachee-1", timezone: "UTC" });
      const session = createMockEnrichedSession({
        id: "s-coachee",
        date: FAR_FUTURE,
      });
      setupSessionWindows({ upcoming: { enrichedSessions: [session] } });

      render(<CoachingSessionsCard onReschedule={vi.fn()} />);

      const row = screen.getByTestId("session-row-s-coachee");
      await user.click(within(row).getByRole("button", { name: /session actions/i }));
      // Share link is the only menu item the coachee should see.
      expect(
        screen.getByRole("menuitem", { name: /share link/i })
      ).toBeInTheDocument();
    });
  });
});
