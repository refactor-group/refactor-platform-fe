import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { PinnedWeekSection } from "@/components/ui/dashboard/session-buckets/pinned-week-section";
import { CoachingSessionBucketView } from "@/types/coaching-session-bucket";
import { createMockEnrichedSession } from "../../../../test-utils";

// `useEnrichedCoachingSessionsForUser` is the data source. We mock it
// to return a controlled set of sessions and ignore the date-range
// args — the test asserts the component's FILTER logic, not the
// fetcher contract (covered separately).
const mockUseEnrichedCoachingSessionsForUser = vi.fn();
vi.mock("@/lib/api/coaching-sessions", () => ({
  CoachingSessionInclude: { Relationship: "relationship", Goal: "goal" },
  useEnrichedCoachingSessionsForUser: () =>
    mockUseEnrichedCoachingSessionsForUser(),
}));

// SessionRow's share-link kebab item routes through clipboard which
// jsdom doesn't fully support — mock the helper away.
vi.mock("@/components/ui/share-session-link", () => ({
  copyCoachingSessionLinkWithToast: vi.fn(),
}));

// Wednesday afternoon, mid-week: lets us put sessions both earlier in
// the week (already past, sessionEnd < now) and later (future).
const NOW = DateTime.fromISO("2026-05-20T20:00:00.000Z", { zone: "utc" });

// `createMockEnrichedSession`'s default is generic; override `id` + `date`
// per fixture so we can assert which rows render via testid.
function sessionAt(id: string, dateIso: string) {
  return createMockEnrichedSession({ id, date: dateIso });
}

// 4 sessions strung across the current calendar week (Sun 5/17 – Sat 5/23).
// `sessionEnd = date + 60min` — anything where sessionEnd < NOW is past.
const monPast = sessionAt("mon-past", "2026-05-18T14:00:00Z"); //  end 15:00 Mon, < NOW
const wedPast = sessionAt("wed-past", "2026-05-20T14:00:00Z"); //  end 15:00 Wed, < NOW
const wedFuture = sessionAt("wed-future", "2026-05-20T22:00:00Z"); // start 22:00 Wed, > NOW
const friFuture = sessionAt("fri-future", "2026-05-22T19:00:00Z"); // > NOW

// Sessions in the previous week (5/10–5/16) — used only for the
// week=previous test.
const lastWedSession = sessionAt(
  "last-wed",
  "2026-05-13T14:00:00Z"
);

function renderSection(overrides: {
  week: "current" | "previous";
  view: CoachingSessionBucketView;
  now?: DateTime;
}) {
  render(
    <PinnedWeekSection
      week={overrides.week}
      view={overrides.view}
      mountNow={NOW}
      now={overrides.now ?? NOW}
      userId="user-1"
      relationshipId={undefined}
      viewerId="coach-1"
      userTimezone="UTC"
      selectedId={undefined}
      onSelect={vi.fn()}
      onReschedule={vi.fn()}
      onRequestDelete={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Variant: week=current, view=Upcoming ─────────────────────────────────
// The original behavior. Sliding past/future cutoff on this week's
// fetched sessions; only non-past survive.
describe("week=current, view=Upcoming", () => {
  beforeEach(() => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [monPast, wedPast, wedFuture, friFuture],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
  });

  it("renders the 'This Week' header with the current Sun–Sat range", () => {
    renderSection({ week: "current", view: CoachingSessionBucketView.Upcoming });
    expect(screen.getByText(/This Week · May 17 – May 23/)).toBeInTheDocument();
  });

  it("shows only sessions that are not yet past", () => {
    renderSection({ week: "current", view: CoachingSessionBucketView.Upcoming });
    expect(screen.queryByTestId("session-row-mon-past")).not.toBeInTheDocument();
    expect(screen.queryByTestId("session-row-wed-past")).not.toBeInTheDocument();
    expect(screen.getByTestId("session-row-wed-future")).toBeInTheDocument();
    expect(screen.getByTestId("session-row-fri-future")).toBeInTheDocument();
  });

  it("renders the upcoming-specific empty message when none qualify", () => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [monPast, wedPast],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
    renderSection({ week: "current", view: CoachingSessionBucketView.Upcoming });
    expect(
      screen.getByText("No upcoming sessions scheduled for this week.")
    ).toBeInTheDocument();
  });
});

// ── Variant: week=current, view=Previous (NEW) ───────────────────────────
// Symmetric to the Upcoming case but the INVERSE filter. The whole
// reason this variant exists: a session that ended an hour ago has
// nowhere to land in the Previous tab without it.
describe("week=current, view=Previous", () => {
  beforeEach(() => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [monPast, wedPast, wedFuture, friFuture],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
  });

  it("shows only sessions that are already past", () => {
    renderSection({
      week: "current",
      view: CoachingSessionBucketView.Previous,
    });
    expect(screen.getByTestId("session-row-mon-past")).toBeInTheDocument();
    expect(screen.getByTestId("session-row-wed-past")).toBeInTheDocument();
    expect(
      screen.queryByTestId("session-row-wed-future")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("session-row-fri-future")
    ).not.toBeInTheDocument();
  });

  it("uses the 'This Week' header and the previous-specific empty message", () => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [wedFuture, friFuture],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
    renderSection({
      week: "current",
      view: CoachingSessionBucketView.Previous,
    });
    expect(screen.getByText(/This Week · May 17 – May 23/)).toBeInTheDocument();
    expect(
      screen.getByText("No previous sessions from this week.")
    ).toBeInTheDocument();
  });

  it("renders past rows with the View button (not Join)", () => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [monPast],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
    renderSection({
      week: "current",
      view: CoachingSessionBucketView.Previous,
    });
    expect(screen.getByRole("link", { name: /view/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^join$/i })).not.toBeInTheDocument();
  });

  it("reclassifies a session from upcoming to past once `now` advances past it", () => {
    // wedFuture starts at 22:00 UTC, ends at 23:00 UTC. With now=20:00
    // it's future; with now=23:30 it has ended → past.
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [wedFuture],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
    const { unmount } = render(
      <PinnedWeekSection
        week="current"
        view={CoachingSessionBucketView.Previous}
        mountNow={NOW}
        now={NOW} // 20:00 — wedFuture is still future, not visible
        userId="user-1"
        relationshipId={undefined}
        viewerId="coach-1"
        userTimezone="UTC"
        selectedId={undefined}
        onSelect={vi.fn()}
        onReschedule={vi.fn()}
        onRequestDelete={vi.fn()}
      />
    );
    expect(
      screen.queryByTestId("session-row-wed-future")
    ).not.toBeInTheDocument();
    unmount();

    // Advance `now` past wedFuture's end (23:00). It now satisfies the
    // past filter and appears.
    renderSection({
      week: "current",
      view: CoachingSessionBucketView.Previous,
      now: DateTime.fromISO("2026-05-20T23:30:00.000Z", { zone: "utc" }),
    });
    expect(screen.getByTestId("session-row-wed-future")).toBeInTheDocument();
  });
});

// ── Variant: week=previous, view=Previous ────────────────────────────────
// Last calendar week — fully past by construction. No `now`-based filter
// runs here, so every session the fetcher returns renders unchanged.
describe("week=previous, view=Previous", () => {
  it("renders all returned sessions without filtering", () => {
    // Returning a future-dated session here would never happen in
    // production (the fetch range is last week's Sun–Sat), but the test
    // verifies the component itself does not filter — every session the
    // hook hands back is rendered.
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [lastWedSession, friFuture],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
    renderSection({
      week: "previous",
      view: CoachingSessionBucketView.Previous,
    });
    expect(screen.getByTestId("session-row-last-wed")).toBeInTheDocument();
    expect(screen.getByTestId("session-row-fri-future")).toBeInTheDocument();
  });

  it("renders the 'Last Week' header with the previous Sun–Sat range", () => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
    renderSection({
      week: "previous",
      view: CoachingSessionBucketView.Previous,
    });
    expect(screen.getByText(/Last Week · May 10 – May 16/)).toBeInTheDocument();
    expect(
      screen.getByText("No previous sessions from last week.")
    ).toBeInTheDocument();
  });
});
