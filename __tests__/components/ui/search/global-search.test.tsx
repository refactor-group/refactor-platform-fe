import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { GlobalSearch, groupSearchHits } from "@/components/ui/search/global-search";
import { useSearch, type SearchState } from "@/lib/api/search";
import { TestProviders } from "@/test-utils/providers";
import { Some, None } from "@/types/option";
import { ItemStatus } from "@/types/general";
import { SearchHitType, type SearchHit } from "@/types/search";
import { TopicStatus } from "@/types/coaching-session-topic";

vi.mock("@/lib/api/search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/search")>();
  return { ...actual, useSearch: vi.fn() };
});

const goalHit: SearchHit = {
  type: SearchHitType.Goal,
  id: "goal-1",
  score: 0.6,
  title: "Weekly planning habit",
  snippet: Some("Build a <mark>weekly</mark> ritual"),
  created_at: "2026-08-14T09:12:00Z",
  updated_at: "2026-09-02T16:40:00Z",
  organization_id: "org-1",
  coaching_relationship_id: Some("rel-1"),
  status: ItemStatus.InProgress,
  created_in_session_id: Some("sess-1"),
};

const actionHit: SearchHit = {
  type: SearchHitType.Action,
  id: "action-1",
  score: 0.3,
  title: "Draft the weekly plan template",
  snippet: None,
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-10T11:30:00Z",
  organization_id: "org-1",
  coaching_relationship_id: Some("rel-1"),
  coaching_session_id: Some("sess-2"),
  goal_id: Some("goal-1"),
  status: ItemStatus.NotStarted,
  due_by: None,
  session_date: Some("2026-09-01T09:00:00"),
  session_title: Some("Weekly sync"),
};

const sessionHit: SearchHit = {
  type: SearchHitType.CoachingSession,
  id: "sess-9",
  score: 0.9,
  title: "Weekly review",
  snippet: None,
  created_at: "2026-09-03T10:00:00Z",
  updated_at: "2026-09-03T10:00:00Z",
  organization_id: "org-1",
  coaching_relationship_id: Some("rel-1"),
  date: "2026-09-03T10:00:00",
};

const agreementHit: SearchHit = {
  type: SearchHitType.Agreement,
  id: "agr-1",
  score: 0.4,
  title: "Plan every Monday",
  snippet: None,
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z",
  organization_id: "org-1",
  coaching_relationship_id: Some("rel-1"),
  coaching_session_id: Some("sess-2"),
  session_date: None,
  session_title: None,
};

const topicHit: SearchHit = {
  type: SearchHitType.Topic,
  id: "topic-1",
  score: 0.2,
  title: "Weekly energy",
  snippet: None,
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z",
  organization_id: "org-1",
  coaching_relationship_id: Some("rel-1"),
  coaching_session_id: Some("sess-2"),
  status: TopicStatus.Open,
  priority: None,
};

const secondActionHit: SearchHit = { ...actionHit, id: "action-2", title: "Book the weekly slot" };

const loaded = (hits: SearchHit[], nextCursor = None as ReturnType<typeof Some<string>> | typeof None): SearchState => ({
  kind: "loaded",
  query: "weekly",
  hits,
  nextCursor,
  isLoadingMore: false,
  loadMoreError: None,
});

function mockSearch(state: SearchState, loadMore = vi.fn()) {
  vi.mocked(useSearch).mockReturnValue({ state, loadMore });
  return loadMore;
}

async function expand() {
  await userEvent.click(screen.getByRole("button", { name: "Open search" }));
  return screen.getByRole("combobox", { name: "Search" });
}

async function typeQuery(text: string) {
  const input = await expand();
  await userEvent.type(input, text);
  return input;
}

describe("GlobalSearch", () => {
  const push = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    });
  });

  it("shows nothing below the field until the query is searchable", async () => {
    mockSearch({ kind: "idle" });
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("w");
    expect(screen.queryByRole("status", { name: "Searching" })).not.toBeInTheDocument();
  });

  it("shows skeleton rows while a search is in flight", async () => {
    mockSearch({ kind: "loading", query: "weekly" });
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");
    expect(screen.getByRole("status", { name: "Searching" })).toBeInTheDocument();
  });

  it("renders hits with highlighted snippet text as marks, not HTML", async () => {
    mockSearch(loaded([goalHit, actionHit]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    expect(screen.getByText("Weekly planning habit")).toBeInTheDocument();
    const mark = screen.getByText("weekly", { selector: "mark" });
    expect(mark.tagName).toBe("MARK");
    expect(screen.queryByText("<mark>")).not.toBeInTheDocument();
    expect(screen.getByText("Not Started · Weekly sync")).toBeInTheDocument();
  });

  it("navigates to the hit's page on select and clears the field", async () => {
    mockSearch(loaded([actionHit]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    await userEvent.click(screen.getByText("Draft the weekly plan template"));

    expect(push).toHaveBeenCalledWith("/coaching-sessions/sess-2?panel=actions&highlight=action-1");
    expect(await expand()).toHaveValue("");
  });

  it("keeps the dropdown open while the pointer is pressed on a result", async () => {
    mockSearch(loaded([actionHit]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    const input = await typeQuery("weekly");
    const row = screen.getByText("Draft the weekly plan template");

    const mouseDown = fireEvent.mouseDown(row);
    expect(mouseDown).toBe(false);
    expect(input).toHaveFocus();
    // Simulate the browser moving focus away without preventDefault.
    fireEvent.blur(input, { relatedTarget: null });
    expect(screen.queryByText("Draft the weekly plan template")).not.toBeInTheDocument();
  });

  it("shows an empty state naming the query", async () => {
    mockSearch(loaded([]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");
    expect(screen.getByText("No results for “weekly”")).toBeInTheDocument();
  });

  it("shows a friendly message for a rate-limited search", async () => {
    mockSearch({ kind: "error", query: "weekly", error: { kind: "rate_limited" } });
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");
    expect(screen.getByRole("alert")).toHaveTextContent("Too many searches at once");
  });

  it("offers to load more when a cursor is pending", async () => {
    const loadMore = mockSearch(loaded([goalHit], Some("CUR")));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    await userEvent.click(screen.getByText("Show more results"));
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it("offers more results instead of an empty state when a page had no recognised hits", async () => {
    const loadMore = mockSearch(loaded([], Some("CUR")));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    expect(screen.queryByText("No results for “weekly”")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Show more results"));
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it("keeps loaded hits beside a failed load-more and offers a retry", async () => {
    const loadMore = mockSearch({
      ...loaded([goalHit], Some("CUR")),
      loadMoreError: Some({ kind: "network" }),
    } as SearchState);
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    expect(screen.getByText("Weekly planning habit")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Can't reach the server");
    await userEvent.click(screen.getByText("Try again"));
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it("is collapsed to a magnifier by default", () => {
    mockSearch({ kind: "idle" });
    render(<GlobalSearch />, { wrapper: TestProviders });
    expect(screen.getByRole("button", { name: "Open search" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("expands and focuses the field when the magnifier is clicked", async () => {
    mockSearch({ kind: "idle" });
    render(<GlobalSearch />, { wrapper: TestProviders });
    const input = await expand();
    expect(input).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Open search" })).not.toBeInTheDocument();
  });

  it.each([
    ["Cmd+K", { key: "k", metaKey: true }],
    ["Ctrl+K", { key: "k", ctrlKey: true }],
    ["/", { key: "/" }],
  ])("expands and focuses on %s from the page", (_, init) => {
    mockSearch({ kind: "idle" });
    render(<GlobalSearch />, { wrapper: TestProviders });

    fireEvent.keyDown(document.body, init);
    expect(screen.getByRole("combobox", { name: "Search" })).toHaveFocus();
  });

  it("ignores Cmd+K typed inside another text field", () => {
    mockSearch({ kind: "idle" });
    render(
      <>
        <input aria-label="Notes" />
        <GlobalSearch />
      </>,
      { wrapper: TestProviders }
    );
    const notes = screen.getByRole("textbox", { name: "Notes" });
    notes.focus();

    fireEvent.keyDown(notes, { key: "k", metaKey: true });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(notes).toHaveFocus();
  });

  it("collapses on Escape with an empty query and returns focus to the magnifier", async () => {
    mockSearch({ kind: "idle" });
    render(<GlobalSearch />, { wrapper: TestProviders });
    await expand();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open search" })).toHaveFocus();
  });

  it("clears the query on Escape and stays open with focus in the field", async () => {
    mockSearch(loaded([goalHit]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    const input = await typeQuery("weekly");

    await userEvent.keyboard("{Escape}");
    expect(input).toHaveValue("");
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("collapses on blur with an empty query", async () => {
    mockSearch({ kind: "idle" });
    render(<GlobalSearch />, { wrapper: TestProviders });
    const input = await expand();

    fireEvent.blur(input, { relatedTarget: null });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open search" })).toBeInTheDocument();
  });

  it("stays expanded on blur with a query", async () => {
    mockSearch(loaded([goalHit]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    const input = await typeQuery("weekly");

    fireEvent.blur(input, { relatedTarget: null });
    expect(screen.getByRole("combobox", { name: "Search" })).toHaveValue("weekly");
    expect(screen.queryByText("Weekly planning habit")).not.toBeInTheDocument();
  });

  it("collapses after a hit is selected", async () => {
    mockSearch(loaded([actionHit]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    await userEvent.click(screen.getByText("Draft the weekly plan template"));

    expect(push).toHaveBeenCalledWith("/coaching-sessions/sess-2?panel=actions&highlight=action-1");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open search" })).toBeInTheDocument();
  });

  describe("collapse animation", () => {
    const mockMedia = (reducedMotion: boolean) => {
      window.matchMedia = vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion") ? reducedMotion : true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    };

    afterEach(() => {
      // jsdom ships without matchMedia; restore that.
      delete (window as { matchMedia?: unknown }).matchMedia;
    });

    it("keeps the pill until the width transition ends, then focuses the magnifier", async () => {
      mockMedia(false);
      mockSearch({ kind: "idle" });
      render(<GlobalSearch />, { wrapper: TestProviders });
      const input = await expand();
      const root = input.closest("[cmdk-root]")!.parentElement!;

      await userEvent.keyboard("{Escape}");
      expect(screen.getByRole("combobox", { name: "Search" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Open search" })).not.toBeInTheDocument();

      // jsdom has no TransitionEvent, so propertyName must be attached by hand.
      const transitionEnd = new Event("transitionend", { bubbles: true });
      Object.defineProperty(transitionEnd, "propertyName", { value: "width" });
      fireEvent(root, transitionEnd);
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open search" })).toHaveFocus();
    });

    it("collapses at once under reduced motion", async () => {
      mockMedia(true);
      mockSearch({ kind: "idle" });
      render(<GlobalSearch />, { wrapper: TestProviders });
      await expand();

      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open search" })).toHaveFocus();
    });
  });

  it("uses the design-system pill input", async () => {
    mockSearch(loaded([goalHit]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    const input = await typeQuery("weekly");

    expect(input).toHaveClass("rounded-full", "bg-fill", "text-item", "focus-visible:ring-1");
    expect(input).not.toHaveClass("rounded-md", "border-input", "focus-visible:ring-2");
    expect(input.closest("[cmdk-root]")?.querySelector("kbd")).toBeNull();

    const panel = input.parentElement?.nextElementSibling;
    expect(panel).toHaveClass("rounded-popover", "shadow-popover", "sm:w-[420px]");
    expect(panel).toHaveTextContent("Weekly planning habit");
  });

  it("groups results by kind, Sessions first, and arrows across groups", async () => {
    mockSearch(loaded([topicHit, actionHit, sessionHit, goalHit, agreementHit]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    const headings = Array.from(document.querySelectorAll("[cmdk-group-heading]")).map(
      (el) => el.textContent
    );
    expect(headings).toEqual(["Sessions", "Goals", "Actions", "Agreements", "Topics"]);

    const row = (title: string) => screen.getByText(title).closest("[cmdk-item]");
    expect(row("Weekly review")).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}");
    expect(row("Weekly planning habit")).toHaveAttribute("aria-selected", "true");
    expect(row("Weekly review")).toHaveAttribute("aria-selected", "false");

    await userEvent.keyboard("{Enter}");
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe("groupSearchHits", () => {
  it("orders groups by kind and keeps the server's order within each", () => {
    const groups = groupSearchHits([
      topicHit,
      actionHit,
      sessionHit,
      goalHit,
      agreementHit,
      secondActionHit,
    ]);

    expect(groups.map((g) => g.heading)).toEqual([
      "Sessions",
      "Goals",
      "Actions",
      "Agreements",
      "Topics",
    ]);
    expect(groups[2].hits.map((h) => h.id)).toEqual(["action-1", "action-2"]);
  });

  it("omits kinds with no hits", () => {
    const groups = groupSearchHits([actionHit, goalHit]);
    expect(groups.map((g) => g.type)).toEqual([SearchHitType.Goal, SearchHitType.Action]);
  });
});
