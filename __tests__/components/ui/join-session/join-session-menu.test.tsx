import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateTime } from "ts-luxon";
import { useRouter } from "next/navigation";
import { JoinSessionMenu } from "@/components/ui/join-session/join-session-menu";
import type { MenuPerson, MenuSession } from "@/components/ui/join-session/types";
import {
  type JoinSessionMenuModel,
  type PersonSessionsState,
  useJoinSessionMenu,
} from "@/lib/hooks/use-join-session-menu";
import { toast } from "@/lib/toast";
import { None, Some } from "@/types/option";

vi.mock("@/lib/hooks/use-join-session-menu", () => ({ useJoinSessionMenu: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn() } }));

const at = (iso: string) => DateTime.fromISO(iso, { zone: "America/Chicago" });
const NOW = at("2026-08-25T14:00");

const ehab: MenuPerson = { userId: "ehab", firstName: "Ehab", fullName: "Ehab Badawi", initials: "EB" };
const priya: MenuPerson = { userId: "priya", firstName: "Priya", fullName: "Priya Raman", initials: "PR" };

const session = (id: string, iso: string, title: string): MenuSession => ({
  id,
  start: at(iso),
  title,
  liveness: "none",
});

const s8 = session("s8", "2026-09-01T10:00", "Session 8");
const s7 = session("s7", "2026-08-11T10:00", "Session 7");
const priyaToday = session("p-today", "2026-08-25T16:30", "Hiring loop");

const loaded: PersonSessionsState = {
  kind: "loaded",
  person: ehab,
  list: [s7, s8],
  groups: [
    { key: "2026-08", label: "Aug", selected: true, sessions: [s7] },
    { key: "2026-09", label: "Sep", selected: false, sessions: [s8] },
  ],
  kindOf: (s) => (s.id === "s8" ? "upcoming" : "past"),
};

const push = vi.fn();

function model(overrides: Partial<JoinSessionMenuModel> = {}): JoinSessionMenuModel {
  return {
    today: [{ session: priyaToday, person: priya }],
    todayError: None,
    people: [
      { person: ehab, when: Some({ text: "Thu", tone: "muted", past: false }), inactive: false },
      { person: priya, when: Some({ text: "4:30pm", tone: "accent", past: false }), inactive: false },
    ],
    hiddenInactive: 0,
    showInactive: vi.fn(),
    selectedId: Some("ehab"),
    page: 0,
    current: None,
    now: NOW,
    sessions: loaded,
    selectPerson: vi.fn(),
    setPage: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

async function openWith(menu: JoinSessionMenuModel) {
  vi.mocked(useJoinSessionMenu).mockReturnValue(menu);
  render(<JoinSessionMenu />);
  await userEvent.click(screen.getByRole("button", { name: "Join session" }));
  return screen.getByRole("dialog");
}

describe("JoinSessionMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  });

  it("renders the Today block, carousel, strip and list", async () => {
    const menu = model();
    const dialog = await openWith(menu);
    expect(menu.reset).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByText("Today")).toBeInTheDocument();
    expect(within(dialog).getByText("Priya Raman")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Ehab/, pressed: true })).toBeInTheDocument();
    expect(within(dialog).getByText("Ehab Badawi")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Aug 11 · Session 7" })).toBeInTheDocument();
    expect(within(dialog).getByText("Session 8")).toBeInTheDocument();
    expect(within(dialog).getByText("Session 7")).toBeInTheDocument();
  });

  it("shows skeleton rows while loading, without the strip", async () => {
    const dialog = await openWith(model({ sessions: { kind: "loading", previous: None } }));
    expect(within(dialog).getByLabelText("Loading sessions").children).toHaveLength(3);
    expect(within(dialog).queryByText("Ehab Badawi")).not.toBeInTheDocument();
  });

  it("sizes the skeleton's date column like the loaded rows, so rows don't shift", async () => {
    const loading = await openWith(model({ sessions: { kind: "loading", previous: None } }));
    const placeholderColumn = within(loading).getByLabelText("Loading sessions").firstElementChild
      ?.firstElementChild;
    expect(placeholderColumn).toHaveClass("w-[92px]", "shrink-0");
    cleanup();

    const loaded = await openWith(model());
    expect(within(loaded).getByText("Tue Aug 11")).toHaveClass("w-[92px]", "shrink-0");
  });

  it("keeps the previous list, inert, while the next person loads", async () => {
    const dialog = await openWith(model({ sessions: { kind: "loading", previous: Some(loaded) } }));
    const busy = within(dialog).getByLabelText("Loading sessions");

    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(busy).toHaveAttribute("inert");
    expect(within(busy).getByText("Ehab Badawi")).toBeInTheDocument();
    expect(within(busy).getByText("Session 8")).toBeInTheDocument();
  });

  it("swaps in the loaded list on the same element, so nothing blinks", async () => {
    vi.mocked(useJoinSessionMenu).mockReturnValue(
      model({ sessions: { kind: "loading", previous: Some(loaded) } })
    );
    const { rerender } = render(<JoinSessionMenu />);
    await userEvent.click(screen.getByRole("button", { name: "Join session" }));
    const list = within(screen.getByRole("dialog")).getByLabelText("Loading sessions");

    vi.mocked(useJoinSessionMenu).mockReturnValue(model({ sessions: loaded }));
    rerender(<JoinSessionMenu />);

    expect(list).toBeInTheDocument();
    expect(list).toHaveAttribute("aria-busy", "false");
    expect(list).not.toHaveAttribute("inert");
  });

  it("offers Try again on error", async () => {
    const retry = vi.fn();
    const dialog = await openWith(model({ sessions: { kind: "error", retry } }));
    expect(within(dialog).getByText(/Couldn.t load sessions/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("says when today's sessions failed and retries them, still listing the person's", async () => {
    const retry = vi.fn();
    const dialog = await openWith(model({ today: [], todayError: Some(retry) }));

    expect(within(dialog).getByText("Couldn't load today's sessions")).toBeInTheDocument();
    expect(within(dialog).getByText("Session 7")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("says when the person has no sessions", async () => {
    const dialog = await openWith(
      model({ sessions: { ...loaded, list: [], groups: [] } as PersonSessionsState })
    );
    expect(within(dialog).getByText("No sessions with Ehab yet")).toBeInTheDocument();
  });

  it("selects a person without closing", async () => {
    const menu = model();
    const dialog = await openWith(menu);
    await userEvent.click(within(dialog).getByRole("button", { name: /Priya/, pressed: false }));
    expect(menu.selectPerson).toHaveBeenCalledWith("priya");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens a row's session, closes, and confirms", async () => {
    const dialog = await openWith(model());
    await userEvent.click(within(dialog).getByText("Session 7"));
    expect(push).toHaveBeenCalledWith("/coaching-sessions/s7");
    expect(toast.success).toHaveBeenCalledWith("Opened Ehab · Aug 11 · Session 7");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a dot's session the same way", async () => {
    const dialog = await openWith(model());
    fireEvent.click(within(dialog).getByRole("button", { name: "Sep 1 · Session 8" }));
    expect(push).toHaveBeenCalledWith("/coaching-sessions/s8");
    expect(toast.success).toHaveBeenCalledWith("Opened Ehab · Sep 1 · Session 8");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a Today row with that row's person", async () => {
    const dialog = await openWith(model());
    await userEvent.click(within(dialog).getByText("Hiring loop"));
    expect(push).toHaveBeenCalledWith("/coaching-sessions/p-today");
    expect(toast.success).toHaveBeenCalledWith("Opened Priya · Aug 25 · Hiring loop");
  });

  it("marks the current session's row", async () => {
    const dialog = await openWith(model({ current: Some("s7") }));
    const row = within(dialog).getByText("Session 7").closest("button")!;
    expect(row).toHaveAttribute("aria-current", "true");
    expect(within(row).getByText("Current")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Current")).toHaveLength(1);
  });
});
