import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { ThisWeekAccordion } from "@/components/ui/dashboard/session-buckets/this-week-accordion";
import { CoachingSessionBucketView } from "@/types/coaching-session-bucket";
import { createMockEnrichedSession } from "../../../../test-utils";

const mockUseEnrichedCoachingSessionsForUser = vi.fn();
vi.mock("@/lib/api/coaching-sessions", () => ({
  CoachingSessionInclude: { Relationship: "relationship", Goal: "goal" },
  useEnrichedCoachingSessionsForUser: () =>
    mockUseEnrichedCoachingSessionsForUser(),
}));

vi.mock("@/components/ui/share-session-link", () => ({
  copyCoachingSessionLinkWithToast: vi.fn(),
}));

// Sun May 24 mid-week → currentWeekRange = Sun May 24 – Sat May 30.
const NOW = DateTime.fromISO("2026-05-24T20:00:00.000Z", { zone: "utc" });

function sessionAt(id: string, dateIso: string) {
  return createMockEnrichedSession({ id, date: dateIso });
}

const earlyToday = sessionAt("early-today", "2026-05-24T14:00:00Z"); // past
const inProgress = sessionAt("in-progress", "2026-05-24T19:30:00Z"); // upcoming-by-end
const laterThisWeek = sessionAt("later-week", "2026-05-28T19:00:00Z"); // future

function renderAccordion(
  view: CoachingSessionBucketView,
  now: DateTime = NOW
) {
  render(
    <ThisWeekAccordion
      view={view}
      mountNow={NOW}
      now={now}
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

describe("ThisWeekAccordion — Upcoming view", () => {
  beforeEach(() => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [earlyToday, inProgress, laterThisWeek],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
  });

  it("renders the THIS WEEK label with the Sun–Sat range and a count", () => {
    renderAccordion(CoachingSessionBucketView.Upcoming);
    // filteredSessions = [inProgress, laterThisWeek] → count 2.
    expect(
      screen.getByText(/This Week · May 24 – May 30/)
    ).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("starts expanded — rows are visible without clicking the chevron", () => {
    renderAccordion(CoachingSessionBucketView.Upcoming);
    expect(screen.getByTestId("session-row-in-progress")).toBeInTheDocument();
    expect(screen.getByTestId("session-row-later-week")).toBeInTheDocument();
  });

  it("collapses + re-expands via the chevron trigger", async () => {
    const user = userEvent.setup();
    renderAccordion(CoachingSessionBucketView.Upcoming);

    await user.click(screen.getByRole("button", { name: /This Week/i }));
    expect(screen.queryByTestId("session-row-in-progress")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /This Week/i }));
    expect(screen.getByTestId("session-row-in-progress")).toBeInTheDocument();
  });

  it("filters out past sessions", () => {
    renderAccordion(CoachingSessionBucketView.Upcoming);
    expect(screen.queryByTestId("session-row-early-today")).not.toBeInTheDocument();
  });
});

describe("ThisWeekAccordion — Previous view", () => {
  it("filters to past sessions only", () => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [earlyToday, inProgress, laterThisWeek],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
    renderAccordion(CoachingSessionBucketView.Previous);
    expect(screen.getByTestId("session-row-early-today")).toBeInTheDocument();
    expect(screen.queryByTestId("session-row-in-progress")).not.toBeInTheDocument();
    expect(screen.queryByTestId("session-row-later-week")).not.toBeInTheDocument();
  });

  it("hides the entire accordion once the view filter empties it", () => {
    // Only future-or-in-progress sessions returned. Previous view filters
    // them all out — accordion should not render at all (no header,
    // no chevron, no body).
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [inProgress, laterThisWeek],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
    renderAccordion(CoachingSessionBucketView.Previous);
    expect(screen.queryByText(/This Week/)).not.toBeInTheDocument();
  });

  it("migrates a session into Previous This Week the moment `now` passes its end", () => {
    mockUseEnrichedCoachingSessionsForUser.mockReturnValue({
      enrichedSessions: [inProgress],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    // At 20:00 UTC: inProgress is still under way → accordion hidden
    // (filter-empty in Previous view).
    const { unmount } = render(
      <ThisWeekAccordion
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
    expect(screen.queryByTestId("session-row-in-progress")).not.toBeInTheDocument();
    unmount();

    // At 20:45 UTC: inProgress has ended → accordion appears with the row.
    renderAccordion(
      CoachingSessionBucketView.Previous,
      DateTime.fromISO("2026-05-24T20:45:00.000Z", { zone: "utc" })
    );
    expect(screen.getByTestId("session-row-in-progress")).toBeInTheDocument();
  });
});
