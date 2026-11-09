import { render, screen, fireEvent, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { None, Some } from "@/types/option";
import { Frequency, Weekday } from "@/types/recurrence";
import { SeriesDetailDialog } from "@/components/ui/dashboard/series-detail-dialog";
import { defaultCoachingSessionSeries } from "@/types/coaching-session-series";
import { createMockSession } from "../../../test-utils";

const mockUseSeries = vi.fn();
vi.mock("@/lib/api/coaching-session-series", () => ({
  useCoachingSessionSeries: (...args: unknown[]) => mockUseSeries(...args),
}));

function viewport(desktop: boolean) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: desktop, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
}

// Monday, November 9 2026, noon in Chicago.
const NOW = new Date("2026-11-09T18:00:00Z");
const TZ = "America/Chicago";

const base = defaultCoachingSessionSeries();
const SERIES = {
  ...base,
  id: "series-1",
  rule: {
    ...base.rule,
    recurrence: { ...base.rule.recurrence, frequency: Frequency.Weekly, interval: 1, by_weekdays: [Weekday.Tue], until: Some("2026-11-17") },
  },
};

// Tuesdays at 4:30 PM Chicago.
const tuesdays = ["2026-10-27T21:30:00", "2026-11-03T22:30:00", "2026-11-10T22:30:00", "2026-11-17T22:30:00"];
const sessions = (dates = tuesdays) => dates.map((date, i) => createMockSession({ id: `cs-${i}`, date }));

function renderDialog(list = sessions(), state: { isLoading?: boolean; isError?: boolean } = {}) {
  mockUseSeries.mockReturnValue({
    series: { coaching_sessions: list },
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
  });
  render(
    <SeriesDetailDialog
      series={Some(SERIES)}
      person={Some({ userId: "user-jane", firstName: "Jane", fullName: "Jane Smith", initials: "JS" })}
      userTimezone={TZ}
      onClose={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  viewport(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const dialog = () => screen.getByRole("dialog", { name: "Recurring series" });

describe("SeriesDetailDialog", () => {
  it("is the shared modal shell, titled Recurring series, with no step position", () => {
    renderDialog();
    expect(dialog()).toBeInTheDocument();
    expect(screen.queryByText(/1 of 1/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next step" })).not.toBeInTheDocument();
  });

  it("names the other person and summarizes the series in the rail", () => {
    renderDialog();
    const d = dialog();
    expect(d).toHaveTextContent("Jane Smith");
    expect(d).toHaveTextContent("Weekly on Tue");
    expect(d).toHaveTextContent("Until Nov 17, 2026");
    expect(d).toHaveTextContent("2 upcoming · 2 done");
  });

  it("lists each session with its day and time, marking done and when the next one is", () => {
    renderDialog();
    const rows = within(dialog()).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Tue, Oct 27 · 4:30 PM"),
      expect.stringContaining("Tue, Nov 3 · 4:30 PM"),
      expect.stringContaining("Tue, Nov 10 · 4:30 PM"),
      expect.stringContaining("Tue, Nov 17 · 4:30 PM"),
    ]);
    expect(rows[0]).toHaveTextContent("Done");
    expect(rows[1]).toHaveTextContent("Done");
    expect(rows[2]).toHaveTextContent("Tomorrow");
    expect(rows[2]).not.toHaveTextContent("Next");
    expect(rows[3]).not.toHaveTextContent(/Done|Tomorrow|In \d/);
  });

  it("says how far off the next session is", () => {
    renderDialog(sessions(["2026-11-03T22:30:00", "2026-11-12T22:30:00"]));
    expect(within(dialog()).getAllByRole("listitem")[1]).toHaveTextContent("In 3 days");
  });

  it("adds the year only when it isn't this year", () => {
    renderDialog(sessions(["2027-01-05T22:30:00"]));
    expect(within(dialog()).getByRole("listitem")).toHaveTextContent("Tue, Jan 5, 2027 · 4:30 PM");
  });

  it("opens a session from its row", () => {
    renderDialog();
    const link = within(within(dialog()).getAllByRole("listitem")[2]).getByRole("link");
    expect(link).toHaveAttribute("href", "/coaching-sessions/cs-2");
  });

  it("pages long series ten at a time", () => {
    const many = Array.from({ length: 25 }, (_, i) => `2026-12-${String((i % 28) + 1).padStart(2, "0")}T22:30:00`);
    renderDialog(sessions(many));
    expect(within(dialog()).getAllByRole("listitem")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "View 10 more" }));
    expect(within(dialog()).getAllByRole("listitem")).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: "View 5 more" }));
    expect(within(dialog()).getAllByRole("listitem")).toHaveLength(25);
    expect(screen.queryByRole("button", { name: /View \d+ more/ })).not.toBeInTheDocument();
  });

  it("keeps loading, error and empty states inside the same shell", () => {
    renderDialog([], { isLoading: true });
    expect(dialog()).toHaveTextContent("Loading sessions");
  });

  it("says when the sessions couldn't load", () => {
    renderDialog([], { isError: true });
    expect(dialog()).toHaveTextContent("Couldn't load this series' sessions.");
  });

  it("says when the series has no sessions", () => {
    renderDialog([]);
    expect(dialog()).toHaveTextContent("This series has no sessions.");
  });

  it("shows the person's own initials, not ones rebuilt from the full name", () => {
    mockUseSeries.mockReturnValue({ series: { coaching_sessions: sessions() }, isLoading: false, isError: false });
    const person = { userId: "user-jan", firstName: "Jan", fullName: "Jan Van Dyke", initials: "JV" };
    render(<SeriesDetailDialog series={Some(SERIES)} person={Some(person)} userTimezone={TZ} onClose={vi.fn()} />);
    expect(dialog()).toHaveTextContent("JV");
  });

  it("renders nothing until the series has loaded", () => {
    render(<SeriesDetailDialog series={None} person={None} userTimezone={TZ} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("leaves the person out when they're unknown", () => {
    mockUseSeries.mockReturnValue({ series: { coaching_sessions: sessions() }, isLoading: false, isError: false });
    render(<SeriesDetailDialog series={Some(SERIES)} person={None} userTimezone={TZ} onClose={vi.fn()} />);
    expect(dialog()).toHaveTextContent("Weekly on Tue");
  });
});
