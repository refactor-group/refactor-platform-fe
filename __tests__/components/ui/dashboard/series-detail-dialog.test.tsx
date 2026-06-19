import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SeriesDetailDialog } from "@/components/ui/dashboard/series-detail-dialog";
import { defaultCoachingSessionSeries } from "@/types/coaching-session-series";
import { createMockSession } from "../../../test-utils";

const mockUseSeries = vi.fn();
vi.mock("@/lib/api/coaching-session-series", () => ({
  useCoachingSessionSeries: (...args: unknown[]) => mockUseSeries(...args),
}));

function makeSessions(n: number) {
  return Array.from({ length: n }, (_, i) =>
    createMockSession({ id: `cs-${i}`, date: "2026-07-15T13:00:00" })
  );
}

function renderWithSessions(count: number) {
  mockUseSeries.mockReturnValue({
    series: { coaching_sessions: makeSessions(count) },
    isLoading: false,
    isError: false,
  });
  render(
    <SeriesDetailDialog
      series={{ ...defaultCoachingSessionSeries(), id: "series-1" }}
      userTimezone="UTC"
      onClose={vi.fn()}
    />
  );
}

const rowCount = () => screen.getAllByRole("listitem").length;
const viewMore = () => screen.queryByRole("button", { name: /view \d+ more/i });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SeriesDetailDialog — View more pagination", () => {
  it("renders all sessions without a View more button when under one page", () => {
    renderWithSessions(7);

    expect(rowCount()).toBe(7);
    expect(viewMore()).not.toBeInTheDocument();
  });

  it("caps the first page at 10 and reveals the rest in pages", () => {
    renderWithSessions(25);

    // First page: 10 rows, 15 remaining → "View 10 more".
    expect(rowCount()).toBe(10);
    expect(
      screen.getByRole("button", { name: "View 10 more" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View 10 more" }));

    // Second page: 20 rows, 5 remaining → label reflects the smaller tail.
    expect(rowCount()).toBe(20);
    expect(
      screen.getByRole("button", { name: "View 5 more" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View 5 more" }));

    // All revealed → button gone.
    expect(rowCount()).toBe(25);
    expect(viewMore()).not.toBeInTheDocument();
  });
});
