import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { TodaysBriefingPanel } from "@/components/ui/dashboard/todays-briefing-panel";

// 03:30 UTC Friday is still Thursday evening in Chicago.
vi.mock("@/lib/hooks/use-now", () => ({
  useNow: () => DateTime.fromISO("2026-11-20T03:30:00Z"),
}));
vi.mock("@/lib/hooks/use-user-timezone", () => ({
  useUserTimezone: () => "America/Chicago",
}));

describe("TodaysBriefingPanel", () => {
  it("titles the panel Today's Briefing at heading level 2", () => {
    render(<TodaysBriefingPanel>{null}</TodaysBriefingPanel>);
    expect(screen.getByRole("heading", { level: 2, name: "Today's Briefing" })).toBeInTheDocument();
  });

  it("shows today's date in the profile zone, not the machine zone", () => {
    render(<TodaysBriefingPanel>{null}</TodaysBriefingPanel>);
    expect(screen.getByText("Thursday, November 19")).toBeInTheDocument();
    expect(screen.queryByText(/Friday/)).not.toBeInTheDocument();
  });

  it("renders its children and no Add New or welcome", () => {
    render(
      <TodaysBriefingPanel>
        <div data-testid="child-a" />
        <div data-testid="child-b" />
      </TodaysBriefingPanel>
    );
    expect(screen.getByTestId("child-a")).toBeInTheDocument();
    expect(screen.getByTestId("child-b")).toBeInTheDocument();
    expect(screen.queryByText(/Add New/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Welcome/i)).not.toBeInTheDocument();
  });
});
