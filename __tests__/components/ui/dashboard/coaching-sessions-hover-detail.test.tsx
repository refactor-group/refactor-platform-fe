import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DateTime, Settings } from "ts-luxon";
import { SessionHoverDetail } from "@/components/ui/dashboard/coaching-sessions-hover-detail";
import { ItemStatus } from "@/types/general";
import { Some } from "@/types/option";
import { createMockAction, createMockEnrichedSession } from "../../../test-utils";

const NOW = DateTime.fromISO("2026-08-25T12:00:00Z", { zone: "utc" });

function renderWith(actions: ReturnType<typeof createMockAction>[]) {
  return render(
    <SessionHoverDetail
      session={createMockEnrichedSession()}
      participantName="Ehab Badawi"
      userTimezone="UTC"
      reviewActions={actions}
    />
  );
}

describe("SessionHoverDetail action rows (compact layout)", () => {
  const originalNow = Settings.now;
  beforeEach(() => {
    Settings.now = () => NOW.toMillis();
  });
  afterEach(() => {
    Settings.now = originalNow;
  });

  it("shows the status glyph, title, meta line and pill, linking to the session's actions", () => {
    renderWith([
      createMockAction({
        id: "a1",
        body: "Send Ehab the notes",
        status: ItemStatus.InProgress,
        due_by: Some(NOW.minus({ days: 5 })),
        coaching_session_id: "sess-9",
      }),
    ]);

    const row = screen.getByRole("link", { name: /Send Ehab the notes/ });
    expect(row).toHaveAttribute("href", "/coaching-sessions/sess-9?panel=actions");
    expect(screen.getByRole("img", { name: "In Progress" })).toBeInTheDocument();
    expect(screen.getByText("Due Aug 20")).toHaveClass("text-warning-text");
    expect(screen.getByText("In Progress", { selector: 'span[data-status="InProgress"]' })).toBeInTheDocument();
    // Display-only here: no status buttons on the dashboard.
    expect(screen.queryByRole("button", { name: /^Status:/ })).not.toBeInTheDocument();
  });

  it("mutes a completed action without striking it through", () => {
    const { container } = renderWith([
      createMockAction({
        id: "a2",
        body: "Draft the weekly plan",
        status: ItemStatus.Completed,
        status_changed_at: NOW.minus({ days: 10 }),
      }),
    ]);

    expect(screen.getByText("Draft the weekly plan")).toHaveClass("text-muted-foreground");
    expect(screen.getByText("Done Aug 15")).toBeInTheDocument();
    expect(container.querySelector(".line-through")).toBeNull();
  });
});
