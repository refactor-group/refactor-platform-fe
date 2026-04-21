import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UpcomingSessionCardEmpty } from "@/components/ui/dashboard/upcoming-session-card-empty";

/**
 * Test Suite: UpcomingSessionCardEmpty
 * Story: "Invite the user to schedule a session when their day is clear —
 * but only coaches can actually schedule; coachees get pointed at their
 * coach instead."
 */

describe("UpcomingSessionCardEmpty", () => {
  it("renders the headline", () => {
    render(
      <UpcomingSessionCardEmpty onCreateSession={vi.fn()} canCreateSession />
    );
    expect(
      screen.getByText("No sessions scheduled for today")
    ).toBeInTheDocument();
  });

  describe("when the viewer can create sessions (coach)", () => {
    it("shows the coach subcopy", () => {
      render(
        <UpcomingSessionCardEmpty onCreateSession={vi.fn()} canCreateSession />
      );
      expect(
        screen.getByText(/schedule a session to get started/i)
      ).toBeInTheDocument();
    });

    it("renders the primary scheduling button", () => {
      render(
        <UpcomingSessionCardEmpty onCreateSession={vi.fn()} canCreateSession />
      );
      expect(
        screen.getByRole("button", { name: /schedule a coaching session/i })
      ).toBeInTheDocument();
    });

    it("invokes onCreateSession when the button is clicked", () => {
      const handleCreate = vi.fn();
      render(
        <UpcomingSessionCardEmpty
          onCreateSession={handleCreate}
          canCreateSession
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: /schedule a coaching session/i })
      );
      expect(handleCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the viewer cannot create sessions (coachee)", () => {
    it("shows coachee-appropriate subcopy directing them to their coach", () => {
      render(
        <UpcomingSessionCardEmpty
          onCreateSession={vi.fn()}
          canCreateSession={false}
        />
      );
      expect(
        screen.getByText(/your coach will schedule your next session/i)
      ).toBeInTheDocument();
    });

    it("does not render the scheduling button", () => {
      render(
        <UpcomingSessionCardEmpty
          onCreateSession={vi.fn()}
          canCreateSession={false}
        />
      );
      expect(
        screen.queryByRole("button", { name: /schedule a coaching session/i })
      ).not.toBeInTheDocument();
    });
  });
});
