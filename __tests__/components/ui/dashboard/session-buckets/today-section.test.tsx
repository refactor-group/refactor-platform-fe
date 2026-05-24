import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { TodaySection } from "@/components/ui/dashboard/session-buckets/today-section";
import { CoachingSessionBucketView } from "@/types/coaching-session-bucket";
import { createMockEnrichedSession } from "../../../../test-utils";

// `useEnrichedCoachingSessionsForUser` is the data source. Mock it so
// tests focus on TodaySection's filter logic, not the fetcher.
const mockUseEnrichedCoachingSessionsForUser = vi.fn();
vi.mock("@/lib/api/coaching-sessions", () => ({
  CoachingSessionInclude: { Relationship: "relationship", Goal: "goal" },
  useEnrichedCoachingSessionsForUser: () =>
    mockUseEnrichedCoachingSessionsForUser(),
}));

vi.mock("@/components/ui/share-session-link", () => ({
  copyCoachingSessionLinkWithToast: vi.fn(),
}));

// Sun May 24 2026, 20:00 UTC = 15:00 CDT. Half the day is past in CDT,
// half is still future — lets us assert the sliding past/future filter.
const NOW = DateTime.fromISO("2026-05-24T20:00:00.000Z", { zone: "utc" });
const TZ = "America/Chicago";

function sessionAt(id: string, dateIso: string) {
  return createMockEnrichedSession({ id, date: dateIso });
}

// Three sessions today: one already past, one in-progress (still within
// its 60-min duration), one upcoming. sessionEnd = date + 60min.
const earlyToday = sessionAt("early-today", "2026-05-24T14:00:00Z"); // end 14:00 → past (< 20:00)
const inProgress = sessionAt("in-progress", "2026-05-24T19:30:00Z"); // end 20:30 → still upcoming
const laterToday = sessionAt("later-today", "2026-05-24T22:00:00Z"); // > 20:00 → upcoming

function renderSection(view: CoachingSessionBucketView, now: DateTime = NOW) {
  render(
    <TodaySection
      view={view}
      mountNow={NOW}
      now={now}
      userId="user-1"
      relationshipId={undefined}
      viewerId="coach-1"
      userTimezone={TZ}
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

describe("TodaySection — view=Upcoming", () => {
  beforeEach(() => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [earlyToday, inProgress, laterToday],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
  });

  it("renders the TODAY label without a date suffix", () => {
    renderSection(CoachingSessionBucketView.Upcoming);
    // Just "Today" — date is communicated in the page header above.
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("shows in-progress and later-today, hides early-today", () => {
    renderSection(CoachingSessionBucketView.Upcoming);
    expect(screen.queryByTestId("session-row-early-today")).not.toBeInTheDocument();
    expect(screen.getByTestId("session-row-in-progress")).toBeInTheDocument();
    expect(screen.getByTestId("session-row-later-today")).toBeInTheDocument();
  });

  it("renders the upcoming empty message when nothing today qualifies", () => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [earlyToday],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
    renderSection(CoachingSessionBucketView.Upcoming);
    expect(
      screen.getByText("No upcoming sessions scheduled for today.")
    ).toBeInTheDocument();
  });
});

describe("TodaySection — view=Previous", () => {
  beforeEach(() => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [earlyToday, inProgress, laterToday],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
  });

  it("shows only past sessions from today", () => {
    renderSection(CoachingSessionBucketView.Previous);
    expect(screen.getByTestId("session-row-early-today")).toBeInTheDocument();
    expect(screen.queryByTestId("session-row-in-progress")).not.toBeInTheDocument();
    expect(screen.queryByTestId("session-row-later-today")).not.toBeInTheDocument();
  });

  it("renders past rows with the View button (not Join)", () => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [earlyToday],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
    renderSection(CoachingSessionBucketView.Previous);
    expect(screen.getByRole("link", { name: /view/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^join$/i })).not.toBeInTheDocument();
  });

  it("uses the previous-specific empty message", () => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [inProgress, laterToday],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
    renderSection(CoachingSessionBucketView.Previous);
    expect(
      screen.getByText("No previous sessions from today.")
    ).toBeInTheDocument();
  });

  it("MIGRATES an upcoming session into Today/Previous the moment `now` passes its end", () => {
    // The handoff contract: a session in Upcoming/Today moves to
    // Previous/Today the moment its duration elapses, driven by the
    // ticking `now`. inProgress starts at 19:30 UTC, ends at 20:30 UTC.
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [inProgress],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    // At 20:00 UTC: inProgress is still under way → not in Previous.
    const { unmount } = render(
      <TodaySection
        view={CoachingSessionBucketView.Previous}
        mountNow={NOW}
        now={NOW}
        userId="user-1"
        relationshipId={undefined}
        viewerId="coach-1"
        userTimezone={TZ}
        selectedId={undefined}
        onSelect={vi.fn()}
        onReschedule={vi.fn()}
        onRequestDelete={vi.fn()}
      />
    );
    expect(screen.queryByTestId("session-row-in-progress")).not.toBeInTheDocument();
    unmount();

    // At 20:45 UTC: inProgress has ended → appears in Previous.
    renderSection(
      CoachingSessionBucketView.Previous,
      DateTime.fromISO("2026-05-24T20:45:00.000Z", { zone: "utc" })
    );
    expect(screen.getByTestId("session-row-in-progress")).toBeInTheDocument();
  });
});
