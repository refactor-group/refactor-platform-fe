import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { GlobalSearch } from "@/components/ui/search/global-search";
import { useSearch, type SearchState } from "@/lib/api/search";
import { TestProviders } from "@/test-utils/providers";
import { Some, None } from "@/types/option";
import { ItemStatus } from "@/types/general";
import { SearchHitType, type SearchHit } from "@/types/search";

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
  session_display_title: Some("Weekly sync"),
};

const loaded = (hits: SearchHit[], nextCursor = None as ReturnType<typeof Some<string>> | typeof None): SearchState => ({
  kind: "loaded",
  query: "weekly",
  hits,
  nextCursor,
  isLoadingMore: false,
});

function mockSearch(state: SearchState, loadMore = vi.fn()) {
  vi.mocked(useSearch).mockReturnValue({ state, loadMore });
  return loadMore;
}

async function typeQuery(text: string) {
  const input = screen.getByRole("combobox", { name: "Search" });
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
    const input = await typeQuery("weekly");

    await userEvent.click(screen.getByText("Draft the weekly plan template"));

    expect(push).toHaveBeenCalledWith("/coaching-sessions/sess-2?panel=actions&highlight=action-1");
    expect(input).toHaveValue("");
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

  it("focuses the field on Cmd+K and clears on Escape", async () => {
    mockSearch(loaded([goalHit]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    const input = screen.getByRole("combobox", { name: "Search" });

    fireEvent.keyDown(document.body, { key: "k", metaKey: true });
    expect(input).toHaveFocus();

    await userEvent.type(input, "weekly");
    await userEvent.keyboard("{Escape}");
    expect(input).toHaveValue("");
  });
});
