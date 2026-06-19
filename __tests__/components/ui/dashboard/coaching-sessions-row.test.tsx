import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionRow } from "@/components/ui/dashboard/coaching-sessions-row";
import { Some } from "@/types/option";
import { createMockEnrichedSession } from "../../../test-utils";

// `copyCoachingSessionLinkWithToast` writes to the clipboard and fires a
// toast — both unrendered in jsdom. Mock the module surface so we can
// assert the right session id was sent without exercising the real path.
const mockCopyLink = vi.fn();
vi.mock("@/components/ui/share-session-link", () => ({
  copyCoachingSessionLinkWithToast: (id: string) => mockCopyLink(id),
}));

const COACH_ID = "coach-1";
const COACHEE_ID = "coachee-1";

function renderRow(opts: {
  viewerId: string;
  isPast?: boolean;
  /** When set, the session belongs to a series with this id. */
  seriesId?: string;
  onReschedule?: ReturnType<typeof vi.fn>;
  onRequestDelete?: ReturnType<typeof vi.fn>;
  onSeriesAction?: ReturnType<typeof vi.fn>;
  onSelect?: ReturnType<typeof vi.fn>;
}) {
  const onReschedule = opts.onReschedule ?? vi.fn();
  const onRequestDelete = opts.onRequestDelete ?? vi.fn();
  const onSeriesAction = opts.onSeriesAction ?? vi.fn();
  const onSelect = opts.onSelect ?? vi.fn();
  const session = createMockEnrichedSession(
    opts.seriesId
      ? { coaching_session_series_id: Some(opts.seriesId) }
      : undefined
  );
  render(
    <SessionRow
      session={session}
      viewerId={opts.viewerId}
      userTimezone="UTC"
      isPast={opts.isPast ?? false}
      isSelected={false}
      onSelect={onSelect}
      onReschedule={onReschedule}
      onRequestDelete={onRequestDelete}
      onSeriesAction={onSeriesAction}
    />
  );
  return { session, onReschedule, onRequestDelete, onSeriesAction, onSelect };
}

async function openKebab() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /session actions/i }));
  return user;
}

describe("SessionRow — kebab visibility by viewer role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Reschedule + Share + Delete for a coach on an upcoming session", async () => {
    renderRow({ viewerId: COACH_ID, isPast: false });
    await openKebab();

    expect(screen.getByTestId("session-row-reschedule")).toBeInTheDocument();
    expect(screen.getByTestId("session-row-share-link")).toBeInTheDocument();
    expect(screen.getByTestId("session-row-delete")).toBeInTheDocument();
  });

  it("hides Reschedule for a coach on a past session but keeps Share + Delete", async () => {
    // Reschedule is gated on `!isPast` — the past row should never offer it,
    // since the session has already happened.
    renderRow({ viewerId: COACH_ID, isPast: true });
    await openKebab();

    expect(screen.queryByTestId("session-row-reschedule")).not.toBeInTheDocument();
    expect(screen.getByTestId("session-row-share-link")).toBeInTheDocument();
    expect(screen.getByTestId("session-row-delete")).toBeInTheDocument();
  });

  it("hides Reschedule and Delete for a coachee viewer — only Share remains", async () => {
    renderRow({ viewerId: COACHEE_ID, isPast: false });
    await openKebab();

    expect(screen.queryByTestId("session-row-reschedule")).not.toBeInTheDocument();
    expect(screen.queryByTestId("session-row-delete")).not.toBeInTheDocument();
    expect(screen.getByTestId("session-row-share-link")).toBeInTheDocument();
  });
});

describe("SessionRow — series actions in the kebab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows View series / Edit series / Delete series for a coach on a session in a series", async () => {
    renderRow({ viewerId: COACH_ID, seriesId: "series-1" });
    await openKebab();

    expect(screen.getByTestId("session-row-view-series")).toBeInTheDocument();
    expect(screen.getByTestId("session-row-edit-series")).toBeInTheDocument();
    expect(screen.getByTestId("session-row-delete-series")).toBeInTheDocument();
  });

  it("shows only View series (not Edit/Delete series) for a coachee", async () => {
    renderRow({ viewerId: COACHEE_ID, seriesId: "series-1" });
    await openKebab();

    expect(screen.getByTestId("session-row-view-series")).toBeInTheDocument();
    expect(
      screen.queryByTestId("session-row-edit-series")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("session-row-delete-series")
    ).not.toBeInTheDocument();
  });

  it("hides all series actions when the session is not part of a series", async () => {
    renderRow({ viewerId: COACH_ID });
    await openKebab();

    expect(
      screen.queryByTestId("session-row-view-series")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("session-row-edit-series")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("session-row-delete-series")
    ).not.toBeInTheDocument();
  });

  it("keeps Edit/Delete series for a coach on a PAST session (not upcoming-gated)", async () => {
    // Series operations target the whole series, so unlike the per-session
    // Reschedule they remain available on past rows.
    renderRow({ viewerId: COACH_ID, isPast: true, seriesId: "series-1" });
    await openKebab();

    expect(
      screen.queryByTestId("session-row-reschedule")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("session-row-edit-series")).toBeInTheDocument();
    expect(screen.getByTestId("session-row-delete-series")).toBeInTheDocument();
  });

  it.each([
    ["view", "session-row-view-series"],
    ["edit", "session-row-edit-series"],
    ["delete", "session-row-delete-series"],
  ] as const)(
    "invokes onSeriesAction('%s', seriesId) when its item fires",
    async (action, testId) => {
      const onSeriesAction = vi.fn();
      renderRow({ viewerId: COACH_ID, seriesId: "series-1", onSeriesAction });
      const user = await openKebab();

      await user.click(screen.getByTestId(testId));
      expect(onSeriesAction).toHaveBeenCalledWith(action, "series-1");
    }
  );
});

describe("SessionRow — primary action button", () => {
  it("renders Join (default) on an upcoming session", () => {
    renderRow({ viewerId: COACH_ID, isPast: false });
    expect(screen.getByRole("link", { name: /join/i })).toBeInTheDocument();
  });

  it("renders View (outline) on a past session", () => {
    renderRow({ viewerId: COACH_ID, isPast: true });
    expect(screen.getByRole("link", { name: /view/i })).toBeInTheDocument();
  });
});

describe("SessionRow — action callbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes onSelect when the row body is clicked", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderRow({ viewerId: COACH_ID });
    await user.click(screen.getByText("Alex Chen"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("invokes onReschedule with the session when the kebab item fires", async () => {
    const user = await openKebabAfterRender();
    await user.click(screen.getByTestId("session-row-reschedule"));
    expect(rescheduleSpy).toHaveBeenCalledTimes(1);
    expect(rescheduleSpy.mock.calls[0][0]).toMatchObject({ id: "session-1" });
  });

  it("invokes onRequestDelete with the session when the kebab item fires", async () => {
    const user = await openKebabAfterRender();
    await user.click(screen.getByTestId("session-row-delete"));
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy.mock.calls[0][0]).toMatchObject({ id: "session-1" });
  });

  it("fires the share-link helper with the session id", async () => {
    const user = await openKebabAfterRender();
    await user.click(screen.getByTestId("session-row-share-link"));
    expect(mockCopyLink).toHaveBeenCalledWith("session-1");
  });
});

// Hoisted spies for the callback tests — set up once per `it` via
// `openKebabAfterRender` so each test sees a fresh render and a fresh
// `user-event` instance.
let rescheduleSpy: ReturnType<typeof vi.fn>;
let deleteSpy: ReturnType<typeof vi.fn>;

async function openKebabAfterRender() {
  rescheduleSpy = vi.fn();
  deleteSpy = vi.fn();
  renderRow({
    viewerId: COACH_ID,
    onReschedule: rescheduleSpy,
    onRequestDelete: deleteSpy,
  });
  return openKebab();
}
