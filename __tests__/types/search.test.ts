import { describe, it, expect } from "vitest";
import {
  SearchHitType,
  isSearchableQuery,
  parseSearchHit,
  parseSearchResponse,
  splitSnippet,
} from "@/types/search";
import { ItemStatus } from "@/types/general";
import { TopicPriority, TopicStatus } from "@/types/coaching-session-topic";

const base = {
  id: "hit-1",
  score: 0.5,
  title: "Weekly planning habit",
  snippet: "Build a <mark>weekly</mark> ritual",
  created_at: "2026-08-14T09:12:00Z",
  updated_at: "2026-09-02T16:40:00Z",
  organization_id: "org-1",
  coaching_relationship_id: "rel-1",
};

describe("parseSearchHit", () => {
  it("parses a coaching session hit", () => {
    const hit = parseSearchHit({
      ...base,
      type: "coaching_session",
      date: "2026-09-01T09:00:00",
      display_title: "Weekly sync",
    });
    expect(hit.some && hit.val.type === SearchHitType.CoachingSession).toBe(true);
    if (hit.some && hit.val.type === SearchHitType.CoachingSession) {
      expect(hit.val.date).toBe("2026-09-01T09:00:00");
      expect(hit.val.snippet).toEqual({ some: true, none: false, val: base.snippet });
    }
  });

  it("wraps nullable goal fields in Option", () => {
    const hit = parseSearchHit({
      ...base,
      type: "goal",
      status: "InProgress",
      created_in_session_id: null,
      snippet: null,
    });
    expect(hit.some).toBe(true);
    if (hit.some && hit.val.type === SearchHitType.Goal) {
      expect(hit.val.status).toBe(ItemStatus.InProgress);
      expect(hit.val.created_in_session_id.none).toBe(true);
      expect(hit.val.snippet.none).toBe(true);
    }
  });

  it("parses action extras", () => {
    const hit = parseSearchHit({
      ...base,
      type: "action",
      coaching_session_id: "sess-1",
      goal_id: "goal-1",
      status: "NotStarted",
      due_by: null,
      session_date: "2026-09-01T09:00:00",
      session_display_title: "Weekly sync",
    });
    if (!hit.some || hit.val.type !== SearchHitType.Action) throw new Error("expected action");
    expect(hit.val.coaching_session_id).toEqual({ some: true, none: false, val: "sess-1" });
    expect(hit.val.goal_id).toEqual({ some: true, none: false, val: "goal-1" });
    expect(hit.val.due_by.none).toBe(true);
  });

  it("parses topic status and priority", () => {
    const hit = parseSearchHit({
      ...base,
      type: "topic",
      coaching_session_id: "sess-1",
      status: "Discussed",
      priority: "High",
    });
    if (!hit.some || hit.val.type !== SearchHitType.Topic) throw new Error("expected topic");
    expect(hit.val.status).toBe(TopicStatus.Discussed);
    expect(hit.val.priority).toEqual({ some: true, none: false, val: TopicPriority.High });
  });

  it("returns None for hit types this client does not know", () => {
    expect(parseSearchHit({ ...base, type: "note" }).none).toBe(true);
    expect(parseSearchHit({ ...base, type: "transcript" }).none).toBe(true);
  });

  it("throws on a hit missing required fields", () => {
    expect(() => parseSearchHit({ type: "goal", id: "x" })).toThrow();
    expect(() => parseSearchHit("nope")).toThrow();
  });
});

describe("parseSearchResponse", () => {
  it("drops unknown types and keeps the cursor", () => {
    const response = parseSearchResponse({
      query: "weekly",
      limit: 25,
      hits: [
        { ...base, type: "goal", status: "InProgress", created_in_session_id: null },
        { ...base, id: "u-1", type: "user" },
        { ...base, id: "ag-1", type: "agreement", coaching_session_id: "sess-1" },
      ],
      next_cursor: "AT2c",
    });
    expect(response.hits.map((h) => h.type)).toEqual([
      SearchHitType.Goal,
      SearchHitType.Agreement,
    ]);
    expect(response.next_cursor).toEqual({ some: true, none: false, val: "AT2c" });
  });

  it("maps a null cursor to None", () => {
    const response = parseSearchResponse({ query: "x", limit: 25, hits: [], next_cursor: null });
    expect(response.next_cursor.none).toBe(true);
  });

  it("throws when hits is not an array", () => {
    expect(() => parseSearchResponse({ query: "x" })).toThrow();
  });
});

describe("splitSnippet", () => {
  it("splits marks into highlighted segments", () => {
    expect(splitSnippet("Build a <mark>weekly</mark> <mark>plan</mark> ritual")).toEqual([
      { text: "Build a ", highlighted: false },
      { text: "weekly", highlighted: true },
      { text: " ", highlighted: false },
      { text: "plan", highlighted: true },
      { text: " ritual", highlighted: false },
    ]);
  });

  it("returns one plain segment when there are no marks", () => {
    expect(splitSnippet("plain text")).toEqual([{ text: "plain text", highlighted: false }]);
  });

  it("never treats other tags as markup", () => {
    expect(splitSnippet("<b>bold</b> <mark>hit</mark>")).toEqual([
      { text: "<b>bold</b> ", highlighted: false },
      { text: "hit", highlighted: true },
    ]);
  });
});

describe("isSearchableQuery", () => {
  it("requires two characters after trimming", () => {
    expect(isSearchableQuery(" a ")).toBe(false);
    expect(isSearchableQuery("ab")).toBe(true);
    expect(isSearchableQuery("  ab  ")).toBe(true);
  });
});
