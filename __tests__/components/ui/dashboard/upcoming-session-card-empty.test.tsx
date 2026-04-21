import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UpcomingSessionCardEmpty } from "@/components/ui/dashboard/upcoming-session-card-empty";

/**
 * Test Suite: UpcomingSessionCardEmpty
 * Story: "Invite the user to schedule a session when their day is clear"
 */

describe("UpcomingSessionCardEmpty", () => {
  it("renders the headline and subcopy", () => {
    render(<UpcomingSessionCardEmpty onCreateSession={vi.fn()} />);
    expect(screen.getByText("No sessions scheduled for today")).toBeInTheDocument();
    expect(screen.getByText(/your day is clear/i)).toBeInTheDocument();
  });

  it("renders the primary scheduling button", () => {
    render(<UpcomingSessionCardEmpty onCreateSession={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /schedule a coaching session/i })
    ).toBeInTheDocument();
  });

  it("invokes onCreateSession when the button is clicked", () => {
    const handleCreate = vi.fn();
    render(<UpcomingSessionCardEmpty onCreateSession={handleCreate} />);
    fireEvent.click(
      screen.getByRole("button", { name: /schedule a coaching session/i })
    );
    expect(handleCreate).toHaveBeenCalledTimes(1);
  });
});
