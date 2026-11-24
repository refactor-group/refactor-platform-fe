import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import {
  GlobalSearch,
  groupSearchHits,
  groupSearchHitsByPerson,
} from "@/components/ui/search/global-search";
import { chipsThatFit } from "@/components/ui/search/search-people-strip";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useSearch, type SearchState } from "@/lib/api/search";
import { TestProviders } from "@/test-utils/providers";
import { Some, None } from "@/types/option";
import { ItemStatus } from "@/types/general";
import { SearchHitType, TranscriptSuggestionTarget, type SearchHit } from "@/types/search";
import { TopicStatus } from "@/types/coaching-session-topic";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import { createMockRelationship } from "../../../test-utils";

vi.mock("@/lib/api/search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/search")>();
  return { ...actual, useSearch: vi.fn() };
});

vi.mock("@/lib/api/coaching-relationships", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/coaching-relationships")>();
  return { ...actual, useCoachingRelationshipList: vi.fn() };
});

function mockRelationships(relationships: CoachingRelationshipWithUserNames[]) {
  vi.mocked(useCoachingRelationshipList).mockReturnValue({
    relationships,
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useCoachingRelationshipList>);
}

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
};

const secondActionHit: SearchHit = { ...actionHit, id: "action-2", title: "Book the weekly slot" };

const suggestionHit: SearchHit = {
  type: SearchHitType.TranscriptSuggestion,
  id: "sugg-1",
  score: 0.2,
  title: "Send the weekly recap to the team",
  snippet: Some("send the <mark>weekly</mark> recap"),
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z",
  organization_id: "org-1",
  coaching_relationship_id: Some("rel-1"),
  target: TranscriptSuggestionTarget.Action,
  coaching_session_id: Some("sess-2"),
  session_date: "2026-09-01T09:00:00",
  session_title: "Weekly sync",
};

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

const mockMedia = ({ wide, reducedMotion }: { wide: boolean; reducedMotion: boolean }) => {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : wide,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe("GlobalSearch", () => {
  const push = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // No relationships: every hit is unattributed, which is the layout before people grouping.
    mockRelationships([]);
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

  it("asks only for the types it renders", () => {
    mockSearch({ kind: "idle" });
    render(<GlobalSearch />, { wrapper: TestProviders });
    expect(useSearch).toHaveBeenLastCalledWith("", {
      types: [
        "coaching_sessions",
        "goals",
        "actions",
        "agreements",
        "topics",
        "transcript_suggestions",
      ],
    });
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

  it("renders a pending suggestion and opens its session's actions panel", async () => {
    mockSearch(loaded([suggestionHit]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    expect(screen.getByText("Suggestion")).toBeInTheDocument();
    expect(screen.getByText("Pending review · Weekly sync")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Send the weekly recap to the team"));
    expect(push).toHaveBeenCalledWith("/coaching-sessions/sess-2?panel=actions&highlight=sugg-1");
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

  describe("blur with a query", () => {
    afterEach(() => {
      delete (window as { matchMedia?: unknown }).matchMedia;
    });

    it("keeps the inline pill and its query", async () => {
      mockMedia({ wide: true, reducedMotion: true });
      mockSearch(loaded([goalHit]));
      render(<GlobalSearch />, { wrapper: TestProviders });
      const input = await typeQuery("weekly");

      fireEvent.blur(input, { relatedTarget: null });
      expect(screen.getByRole("combobox", { name: "Search" })).toHaveValue("weekly");
      expect(screen.queryByText("Weekly planning habit")).not.toBeInTheDocument();
    });

    it("collapses the phone overlay so the header shows again, keeping the query", async () => {
      mockMedia({ wide: false, reducedMotion: false });
      mockSearch(loaded([goalHit]));
      render(<GlobalSearch />, { wrapper: TestProviders });
      const input = await typeQuery("weekly");

      fireEvent.blur(input, { relatedTarget: null });
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Open search" }));
      expect(screen.getByRole("combobox", { name: "Search" })).toHaveValue("weekly");
    });
  });

  it("keeps focus in the field when Clear is pressed, so the overlay can't close first", async () => {
    mockSearch(loaded([goalHit]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    const pressed = fireEvent.mouseDown(screen.getByRole("button", { name: "Clear search" }));
    expect(pressed).toBe(false);
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
    afterEach(() => {
      // jsdom ships without matchMedia; restore that.
      delete (window as { matchMedia?: unknown }).matchMedia;
    });

    it("keeps the pill until the width transition ends, then focuses the magnifier", async () => {
      mockMedia({ wide: true, reducedMotion: false });
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
      mockMedia({ wide: true, reducedMotion: true });
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
    expect(panel).toHaveClass("rounded-popover", "shadow-popover", "md:w-[420px]");
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

const ME = "me";

const JIM = { first_name: "Jim", last_name: "Hodapp", email: "jim@example.com" };
const seat = (first: string, last: string) => ({
  first_name: first,
  last_name: last,
  email: `${first.toLowerCase()}@example.com`,
});

const coachedByMe = (id: string, personId: string, first: string, last: string) =>
  createMockRelationship(
    { id, coach_id: ME, coachee_id: personId },
    { coach: JIM, coachee: seat(first, last) }
  );

const EHAB = coachedByMe("rel-ehab", "ehab", "Ehab", "Bandar");
const CALEB = coachedByMe("rel-caleb", "caleb", "Caleb", "Ortiz");
const PRIYA = coachedByMe("rel-priya", "priya", "Priya", "Raman");
const SARAH = coachedByMe("rel-sarah", "sarah", "Sarah", "Kim");
const ALEX = coachedByMe("rel-alex", "alex", "Alex", "Chen");
const LENA = coachedByMe("rel-lena", "lena", "Lena", "Torres");
// Ehab also coaches the signed-in user: a second relationship with the same person.
const EHAB_COACHES_ME = createMockRelationship(
  { id: "rel-ehab-reverse", coach_id: "ehab", coachee_id: ME },
  { coach: seat("Ehab", "Bandar"), coachee: JIM }
);

const hitFor = (relationshipId: string | null, id: string): SearchHit => ({
  ...goalHit,
  id,
  title: `Goal ${id}`,
  snippet: None,
  coaching_relationship_id: relationshipId === null ? None : Some(relationshipId),
});

describe("groupSearchHitsByPerson", () => {
  const relationships = [EHAB, CALEB, EHAB_COACHES_ME];

  it("orders people by first appearance and keeps the server's order within each", () => {
    const { people, other } = groupSearchHitsByPerson(
      [hitFor("rel-caleb", "c1"), hitFor("rel-ehab", "e1"), hitFor("rel-caleb", "c2"), hitFor("rel-ehab", "e2")],
      relationships,
      ME
    );

    expect(people.map((g) => g.person.fullName)).toEqual(["Caleb Ortiz", "Ehab Bandar"]);
    expect(people[0].hits.map((h) => h.id)).toEqual(["c1", "c2"]);
    expect(people[1].hits.map((h) => h.id)).toEqual(["e1", "e2"]);
    expect(other).toEqual([]);
  });

  it("collapses two relationships with the same person into one group", () => {
    const { people } = groupSearchHitsByPerson(
      [hitFor("rel-ehab", "e1"), hitFor("rel-ehab-reverse", "e2")],
      relationships,
      ME
    );

    expect(people).toHaveLength(1);
    expect(people[0].person.userId).toBe("ehab");
    expect(people[0].hits.map((h) => h.id)).toEqual(["e1", "e2"]);
  });

  it("leaves hits with no relationship, or an unknown one, in other", () => {
    const { people, other } = groupSearchHitsByPerson(
      [hitFor(null, "none"), hitFor("rel-ehab", "e1"), hitFor("rel-elsewhere", "unknown")],
      relationships,
      ME
    );

    expect(people.map((g) => g.person.userId)).toEqual(["ehab"]);
    expect(other.map((h) => h.id)).toEqual(["none", "unknown"]);
  });

  it("leaves hits from a relationship the user is not part of in other", () => {
    // An admin's list includes relationships between two other people.
    const betweenOthers = createMockRelationship(
      { id: "rel-others", coach_id: "caleb", coachee_id: "ehab" },
      { coach: seat("Caleb", "Ortiz"), coachee: seat("Ehab", "Bandar") }
    );
    const { people, other } = groupSearchHitsByPerson(
      [hitFor("rel-others", "theirs"), hitFor("rel-ehab", "e1")],
      [...relationships, betweenOthers],
      ME
    );

    expect(people.map((g) => g.person.userId)).toEqual(["ehab"]);
    expect(people[0].hits.map((h) => h.id)).toEqual(["e1"]);
    expect(other.map((h) => h.id)).toEqual(["theirs"]);
  });
});

describe("chipsThatFit", () => {
  it("shows every chip when they all fit, without reserving room for the overflow chip", () => {
    expect(chipsThatFit(100, [30, 30, 28], 40, 6)).toBe(3);
  });

  it("keeps room for the overflow chip when some are left over", () => {
    // 4 chips = 138; 3 chips + gap + overflow = 148; 2 chips + gap + overflow = 112.
    expect(chipsThatFit(120, [30, 30, 30, 30], 40, 6)).toBe(2);
  });

  it("always shows at least one person", () => {
    expect(chipsThatFit(10, [30, 30], 40, 6)).toBe(1);
  });
});

describe("GlobalSearch results by person", () => {
  const push = vi.fn();
  const scrollTo = vi.fn();
  const DIMMED_ROWS = "[&_[cmdk-item]:not([data-selected=true])]:opacity-[0.32]";

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("auth-store", JSON.stringify({ state: { userId: ME }, version: 2 }));
    // jsdom has no Element.scrollTo.
    Element.prototype.scrollTo = scrollTo;
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    });
  });

  afterEach(() => {
    localStorage.removeItem("auth-store");
    delete (Element.prototype as { scrollTo?: unknown }).scrollTo;
  });

  const group = (name: string) => screen.getByRole("group", { name });
  const rowsIn = (name: string) => within(group(name)).getAllByRole("option");
  const chip = (name: RegExp) => screen.getByRole("button", { name });

  const sevenForEhabOneForCaleb = [
    ...Array.from({ length: 4 }, (_, i) => hitFor("rel-ehab", `e${i + 1}`)),
    hitFor("rel-caleb", "c1"),
    ...Array.from({ length: 3 }, (_, i) => hitFor("rel-ehab", `e${i + 5}`)),
  ];

  it("renders a chip and a band per person, in order of each person's first hit", async () => {
    mockRelationships([EHAB, CALEB]);
    mockSearch(loaded([hitFor("rel-caleb", "c1"), hitFor("rel-ehab", "e1"), hitFor("rel-caleb", "c2")]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    expect(screen.getAllByRole("button", { name: /results?$/ }).map((b) => b.textContent)).toEqual([
      "CO" + "Caleb" + "2",
      "EB" + "Ehab" + "1",
    ]);
    expect(within(group("Caleb Ortiz")).getByText("2 results")).toBeInTheDocument();
    expect(within(group("Ehab Bandar")).getByText("1 result")).toBeInTheDocument();
    expect(rowsIn("Caleb Ortiz").map((row) => row.textContent)).toEqual([
      expect.stringContaining("Goal c1"),
      expect.stringContaining("Goal c2"),
    ]);
    expect(document.querySelectorAll("[cmdk-group-heading]")).toHaveLength(0);
  });

  it("keeps grouping by kind for one person, under a line naming them", async () => {
    mockRelationships([EHAB]);
    mockSearch(
      loaded([
        { ...goalHit, coaching_relationship_id: Some("rel-ehab") },
        { ...sessionHit, coaching_relationship_id: Some("rel-ehab") },
      ])
    );
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    expect(screen.getByText("All results are with")).toHaveTextContent(
      "All results are with Ehab Bandar"
    );
    const headings = Array.from(document.querySelectorAll("[cmdk-group-heading]")).map(
      (el) => el.textContent
    );
    expect(headings).toEqual(["Sessions", "Goals"]);
    expect(screen.queryByRole("button", { name: /results?$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Ehab Bandar" })).not.toBeInTheDocument();
  });

  it("gives one person a band, with no strip, when other hits have no person", async () => {
    mockRelationships([EHAB]);
    mockSearch(loaded([hitFor("rel-ehab", "e1"), hitFor(null, "none"), hitFor("rel-elsewhere", "far")]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    expect(rowsIn("Ehab Bandar")).toHaveLength(1);
    const otherHeading = screen.getByText("Other results");
    expect(otherHeading).toHaveAttribute("cmdk-group-heading");
    expect(within(otherHeading.parentElement!).getAllByRole("option")).toHaveLength(2);
    expect(screen.queryByText("All results are with")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Ehab Bandar,/ })).not.toBeInTheDocument();
  });

  it("puts hits with no person last, under Other results", async () => {
    mockRelationships([EHAB, CALEB]);
    mockSearch(loaded([hitFor(null, "none"), hitFor("rel-ehab", "e1"), hitFor("rel-caleb", "c1")]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    const titles = screen.getAllByRole("option").map((row) => row.textContent);
    expect(titles).toEqual([
      expect.stringContaining("Goal e1"),
      expect.stringContaining("Goal c1"),
      expect.stringContaining("Goal none"),
    ]);
    expect(screen.getByText("Other results")).toBeInTheDocument();
  });

  it("shows five rows for a person with seven hits and expands to all seven", async () => {
    mockRelationships([EHAB, CALEB]);
    mockSearch(loaded(sevenForEhabOneForCaleb));
    render(<GlobalSearch />, { wrapper: TestProviders });
    const input = await typeQuery("weekly");

    expect(rowsIn("Ehab Bandar")).toHaveLength(5);
    const expander = within(group("Ehab Bandar")).getByRole("button", { name: "7 results" });
    expect(expander).toHaveAttribute("aria-expanded", "false");
    expect(within(group("Caleb Ortiz")).queryByRole("button")).not.toBeInTheDocument();

    expect(fireEvent.mouseDown(expander)).toBe(false);
    await userEvent.click(expander);
    expect(rowsIn("Ehab Bandar")).toHaveLength(7);
    expect(expander).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveFocus();

    await userEvent.click(expander);
    expect(rowsIn("Ehab Bandar")).toHaveLength(5);
  });

  it("spotlights a picked person, dims the other groups, and clears on a second click", async () => {
    mockRelationships([EHAB, CALEB]);
    mockSearch(loaded([hitFor("rel-ehab", "e1"), hitFor("rel-caleb", "c1"), hitFor(null, "none")]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    const input = await typeQuery("weekly");
    const caleb = chip(/^Caleb Ortiz,/);
    const other = screen.getByText("Other results").parentElement!;

    expect(caleb).toHaveAttribute("aria-pressed", "false");
    expect(fireEvent.mouseDown(caleb)).toBe(false);
    await userEvent.click(caleb);

    expect(caleb).toHaveAttribute("aria-pressed", "true");
    expect(chip(/^Ehab Bandar,/)).toHaveAttribute("aria-pressed", "false");
    expect(group("Caleb Ortiz")).toHaveAttribute("data-dimmed", "false");
    expect(group("Ehab Bandar")).toHaveAttribute("data-dimmed", "true");
    expect(other).toHaveAttribute("data-dimmed", "true");
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(input).toHaveFocus();

    await userEvent.click(caleb);
    expect(caleb).toHaveAttribute("aria-pressed", "false");
    expect(group("Ehab Bandar")).toHaveAttribute("data-dimmed", "false");
    expect(other).toHaveAttribute("data-dimmed", "false");
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("dims rows, not the group, so the highlighted row in a dimmed group stays readable", async () => {
    mockRelationships([EHAB, CALEB]);
    mockSearch(loaded([hitFor("rel-ehab", "e1"), hitFor("rel-caleb", "c1")]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");
    await userEvent.click(chip(/^Caleb Ortiz,/));

    const ehab = group("Ehab Bandar");
    // Opacity on the group itself would fade the highlighted row with it.
    expect(ehab.className).not.toMatch(/(^|\s)opacity-/);
    expect(ehab).toHaveClass(DIMMED_ROWS);
    expect(group("Caleb Ortiz")).not.toHaveClass(DIMMED_ROWS);
    // The dim rule skips rows carrying data-selected, which cmdk sets on the highlighted one.
    expect(within(ehab).getByRole("option")).toHaveAttribute("data-selected", "true");
  });

  it("still navigates from a dimmed row", async () => {
    mockRelationships([EHAB, CALEB]);
    mockSearch(loaded([hitFor("rel-ehab", "e1"), hitFor("rel-caleb", "c1")]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    await userEvent.click(chip(/^Caleb Ortiz,/));
    await userEvent.click(screen.getByText("Goal e1"));
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("shows no overflow chip while everyone fits", async () => {
    mockRelationships([EHAB, CALEB, PRIYA, SARAH]);
    mockSearch(
      loaded(["rel-ehab", "rel-caleb", "rel-priya", "rel-sarah"].map((rel) => hitFor(rel, rel)))
    );
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    expect(screen.getAllByRole("button", { name: /results?$/ })).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /more (person|people)$/ })).not.toBeInTheDocument();
  });

  it("puts people who don't fit behind an overflow chip, and picks from its menu", async () => {
    mockRelationships([EHAB, CALEB, PRIYA, SARAH, ALEX, LENA]);
    mockSearch(
      loaded(
        ["rel-ehab", "rel-caleb", "rel-priya", "rel-sarah", "rel-alex", "rel-lena"].map((rel) =>
          hitFor(rel, rel)
        )
      )
    );
    render(<GlobalSearch />, { wrapper: TestProviders });
    const input = await typeQuery("weekly");

    const more = screen.getByRole("button", { name: "2 more people" });
    expect(more).toHaveTextContent("+2");
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /^Lena Torres,/ })).not.toBeInTheDocument();

    expect(fireEvent.mouseDown(more)).toBe(false);
    await userEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("group", { name: "More people" });
    expect(within(menu).getAllByRole("button")).toHaveLength(2);

    await userEvent.click(within(menu).getByRole("button", { name: /^Lena Torres,/ }));
    expect(screen.queryByRole("group", { name: "More people" })).not.toBeInTheDocument();
    expect(group("Lena Torres")).toHaveAttribute("data-dimmed", "false");
    expect(group("Ehab Bandar")).toHaveAttribute("data-dimmed", "true");
    expect(more).toHaveClass("bg-brand-tint");
    expect(input).toHaveFocus();
  });

  it("closes the overflow menu on Escape without clearing the query", async () => {
    mockRelationships([EHAB, CALEB, PRIYA, SARAH, ALEX, LENA]);
    mockSearch(
      loaded(
        ["rel-ehab", "rel-caleb", "rel-priya", "rel-sarah", "rel-alex", "rel-lena"].map((rel) =>
          hitFor(rel, rel)
        )
      )
    );
    render(<GlobalSearch />, { wrapper: TestProviders });
    const input = await typeQuery("weekly");

    await userEvent.click(screen.getByRole("button", { name: "2 more people" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("group", { name: "More people" })).not.toBeInTheDocument();
    expect(input).toHaveValue("weekly");
  });

  it("appends a page without clearing the spotlight or the expanded group", async () => {
    mockRelationships([EHAB, CALEB, PRIYA]);
    mockSearch(loaded(sevenForEhabOneForCaleb, Some("CUR")));
    const { rerender } = render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    await userEvent.click(within(group("Ehab Bandar")).getByRole("button", { name: "7 results" }));
    await userEvent.click(chip(/^Ehab Bandar,/));

    mockSearch(loaded([...sevenForEhabOneForCaleb, hitFor("rel-ehab", "e8"), hitFor("rel-priya", "p1")]));
    rerender(<GlobalSearch />);

    expect(chip(/^Ehab Bandar, 8 results/)).toHaveAttribute("aria-pressed", "true");
    expect(rowsIn("Ehab Bandar")).toHaveLength(8);
    expect(group("Caleb Ortiz")).toHaveAttribute("data-dimmed", "true");
    // A person first seen on the new page joins the end of the strip and the list.
    expect(chip(/^Priya Raman, 1 result/)).toBeInTheDocument();
    expect(group("Priya Raman")).toHaveAttribute("data-dimmed", "true");
  });

  it("resets the spotlight and expanded groups for a new query", async () => {
    mockRelationships([EHAB, CALEB]);
    mockSearch(loaded(sevenForEhabOneForCaleb));
    const { rerender } = render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    await userEvent.click(within(group("Ehab Bandar")).getByRole("button", { name: "7 results" }));
    await userEvent.click(chip(/^Ehab Bandar,/));

    mockSearch({ ...loaded(sevenForEhabOneForCaleb), query: "weekly plan" } as SearchState);
    rerender(<GlobalSearch />);

    expect(chip(/^Ehab Bandar,/)).toHaveAttribute("aria-pressed", "false");
    expect(rowsIn("Ehab Bandar")).toHaveLength(5);
    expect(group("Caleb Ortiz")).toHaveAttribute("data-dimmed", "false");
  });

  it("loads relationships only once the field opens", async () => {
    localStorage.setItem(
      "organization-state-store",
      JSON.stringify({ state: { currentOrganizationId: "org-1" }, version: 2 })
    );
    try {
      mockRelationships([]);
      mockSearch(loaded([]));
      render(<GlobalSearch />, { wrapper: TestProviders });

      expect(useCoachingRelationshipList).toHaveBeenCalled();
      expect(useCoachingRelationshipList).not.toHaveBeenCalledWith("org-1");

      await expand();
      expect(useCoachingRelationshipList).toHaveBeenLastCalledWith("org-1");
    } finally {
      localStorage.removeItem("organization-state-store");
    }
  });

  it("arrows across person groups, dimmed rows included, and Enter opens the row", async () => {
    mockRelationships([EHAB, CALEB]);
    mockSearch(loaded([hitFor("rel-ehab", "e1"), hitFor("rel-caleb", "c1"), hitFor(null, "none")]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");
    await userEvent.click(chip(/^Ehab Bandar,/));

    const row = (title: string) => screen.getByText(title).closest("[cmdk-item]");
    expect(row("Goal e1")).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}");
    expect(row("Goal c1")).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}");
    expect(row("Goal none")).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Enter}");
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("lets Enter on a focused chip pick the person instead of opening a result", async () => {
    mockRelationships([EHAB, CALEB]);
    mockSearch(loaded([hitFor("rel-ehab", "e1"), hitFor("rel-caleb", "c1")]));
    render(<GlobalSearch />, { wrapper: TestProviders });
    await typeQuery("weekly");

    const caleb = chip(/^Caleb Ortiz,/);
    caleb.focus();
    expect(screen.getByRole("combobox", { name: "Search" })).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");

    expect(caleb).toHaveAttribute("aria-pressed", "true");
    expect(push).not.toHaveBeenCalled();
  });
});
