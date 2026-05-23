import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { PinnedWeekSection } from "@/components/ui/dashboard/session-buckets/pinned-week-section";
import { CoachingSessionBucketView } from "@/types/coaching-session-bucket";
import { createMockEnrichedSession } from "../../../../test-utils";

// `useEnrichedCoachingSessionsForUser` is the data source. Mock it to
// return a controlled set of sessions so the tests focus on the
// component's FILTER logic, not the fetcher contract.
const mockUseEnrichedCoachingSessionsForUser = vi.fn();
vi.mock("@/lib/api/coaching-sessions", () => ({
  CoachingSessionInclude: { Relationship: "relationship", Goal: "goal" },
  useEnrichedCoachingSessionsForUser: () =>
    mockUseEnrichedCoachingSessionsForUser(),
}));

// SessionRow's share-link kebab routes through clipboard, which jsdom
// only partially supports — mock the helper.
vi.mock("@/components/ui/share-session-link", () => ({
  copyCoachingSessionLinkWithToast: vi.fn(),
}));

// Wednesday afternoon UTC. Lets us place sessions both earlier in the
// week (already past, sessionEnd < now) and later (future).
const NOW = DateTime.fromISO("2026-05-20T20:00:00.000Z", { zone: "utc" });

function sessionAt(id: string, dateIso: string) {
  return createMockEnrichedSession({ id, date: dateIso });
}

// Sessions across the current calendar week (Sun 5/17 – Sat 5/23).
// `sessionEnd = date + 60min`; anything where sessionEnd < NOW is past.
const monPast = sessionAt("mon-past", "2026-05-18T14:00:00Z");
const wedPast = sessionAt("wed-past", "2026-05-20T14:00:00Z");
const wedFuture = sessionAt("wed-future", "2026-05-20T22:00:00Z");
const friFuture = sessionAt("fri-future", "2026-05-22T19:00:00Z");

// Sessions in the previous calendar week (5/10–5/16) — all past.
const lastWedSession = sessionAt("last-wed", "2026-05-13T14:00:00Z");

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
// Sliding past/future cutoff on this week's fetched sessions; only
// non-past survive.
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

// ── Variant: week=previous, view=Previous ────────────────────────────────
// "Last Week" — fetch range now spans [prev Sun, end of anchor day],
// so this week's already-ended sessions are inside the window and the
// past filter surfaces them. Sessions migrate here automatically as
// soon as their end time elapses.
describe("week=previous, view=Previous", () => {
  it("renders the 'Last Week' header with range from prev Sun to anchor day", () => {
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
    // Anchor is Wed 5/20 → range covers May 10 (prev Sun) through end
    // of May 20 — so the label terminates at the anchor's date.
    expect(screen.getByText(/Last Week · May 10 – May 20/)).toBeInTheDocument();
    expect(
      screen.getByText("No previous sessions from last week.")
    ).toBeInTheDocument();
  });

  it("shows past sessions from both the previous week AND this week's already-ended ones", () => {
    // The whole point of the new range semantics: a session today that
    // has already ended (wedPast) belongs in 'Last Week' even though
    // it's calendar-wise in this week.
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [lastWedSession, monPast, wedPast, wedFuture, friFuture],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
    renderSection({
      week: "previous",
      view: CoachingSessionBucketView.Previous,
    });
    expect(screen.getByTestId("session-row-last-wed")).toBeInTheDocument();
    expect(screen.getByTestId("session-row-mon-past")).toBeInTheDocument();
    expect(screen.getByTestId("session-row-wed-past")).toBeInTheDocument();
    expect(
      screen.queryByTestId("session-row-wed-future")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("session-row-fri-future")
    ).not.toBeInTheDocument();
  });

  it("renders past rows with the View button (not Join)", () => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [lastWedSession],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
    renderSection({
      week: "previous",
      view: CoachingSessionBucketView.Previous,
    });
    expect(screen.getByRole("link", { name: /view/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^join$/i })).not.toBeInTheDocument();
  });

  it("MIGRATES an upcoming session into Last Week the moment `now` passes its end", () => {
    // The migration contract: a session in Upcoming "This Week" should
    // appear in Previous "Last Week" once its duration elapses, driven
    // by the same ticking `now`. wedFuture ends at 23:00 UTC.
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [wedFuture],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    // Render 1: now=20:00 — wedFuture is still upcoming, not in Last Week.
    const { unmount } = render(
      <PinnedWeekSection
        week="previous"
        view={CoachingSessionBucketView.Previous}
        mountNow={NOW}
        now={NOW}
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
    expect(screen.queryByTestId("session-row-wed-future")).not.toBeInTheDocument();
    unmount();

    // Render 2: now=23:30 — wedFuture has ended → past → appears.
    renderSection({
      week: "previous",
      view: CoachingSessionBucketView.Previous,
      now: DateTime.fromISO("2026-05-20T23:30:00.000Z", { zone: "utc" }),
    });
    expect(screen.getByTestId("session-row-wed-future")).toBeInTheDocument();
  });
});
