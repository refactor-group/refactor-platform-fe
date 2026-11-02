import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime, Settings } from "ts-luxon";
import { SessionHoverDetail } from "@/components/ui/dashboard/coaching-sessions-hover-detail";
import { ItemStatus } from "@/types/general";
import { Some } from "@/types/option";
import { toast } from "@/lib/toast";
import { createMockAction, createMockEnrichedSession } from "../../../test-utils";

const update = vi.fn();
const revalidateGoalProgress = vi.fn();
vi.mock("@/lib/api/actions", () => ({ useActionMutation: () => ({ update }) }));
vi.mock("@/lib/api/goal-progress", () => ({ useRevalidateGoalProgress: () => revalidateGoalProgress }));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));

const NOW = DateTime.fromISO("2026-08-25T12:00:00Z", { zone: "utc" });

function renderWith(actions: ReturnType<typeof createMockAction>[]) {
  return render(
    <SessionHoverDetail
      session={createMockEnrichedSession()}
      participantName="Ehab Badawi"
      userTimezone="UTC"
      reviewActions={actions}
      locale="en-US"
    />
  );
}

describe("SessionHoverDetail action rows (compact layout)", () => {
  const originalNow = Settings.now;
  beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue(undefined);
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
    expect(screen.getByRole("button", { name: "Status: In Progress" })).toBeInTheDocument();
    expect(screen.getByText("Due Aug 20")).toHaveClass("text-warning-text");
    expect(screen.getByText("In Progress", { selector: 'span[data-status="InProgress"]' })).toBeInTheDocument();
  });

  it("saves a status chosen from the row", async () => {
    const action = createMockAction({ id: "a1", body: "Send Ehab the notes", status: ItemStatus.InProgress });
    renderWith([action]);

    await userEvent.click(screen.getByRole("button", { name: "Status: In Progress" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: /Completed/ }));

    expect(update).toHaveBeenCalledWith("a1", { ...action, status: ItemStatus.Completed });
    expect(revalidateGoalProgress).not.toHaveBeenCalled();
  });

  it("refreshes goal progress when the action is linked to a goal", async () => {
    renderWith([createMockAction({ id: "a1", status: ItemStatus.InProgress, goal_id: Some("goal-1") })]);

    await userEvent.click(screen.getByRole("button", { name: "Status: In Progress" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: /Completed/ }));

    await waitFor(() => expect(revalidateGoalProgress).toHaveBeenCalled());
  });

  it("says so when the status can't be saved", async () => {
    update.mockRejectedValue(new Error("boom"));
    renderWith([createMockAction({ id: "a1", status: ItemStatus.InProgress })]);

    await userEvent.click(screen.getByRole("button", { name: "Status: In Progress" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: /Completed/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't update the status"));
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
