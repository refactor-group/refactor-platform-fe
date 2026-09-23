import { describe, it, expect } from "vitest";
import { searchHitHref } from "@/lib/utils/search-hit-href";
import { Some, None } from "@/types/option";
import { ItemStatus } from "@/types/general";
import { TopicStatus } from "@/types/coaching-session-topic";
import { SearchHitType, type SearchHit } from "@/types/search";

const base = {
  id: "hit-1",
  score: 1,
  title: "t",
  snippet: None,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  organization_id: "org-1",
  coaching_relationship_id: Some("rel-1"),
};

describe("searchHitHref", () => {
  it("links sessions to their page", () => {
    const hit: SearchHit = {
      ...base,
      type: SearchHitType.CoachingSession,
      date: "2026-01-01T00:00:00",
      display_title: "x",
    };
    expect(searchHitHref(hit)).toEqual(Some("/coaching-sessions/hit-1"));
  });

  it("links goals to the goals panel of their creating session, else the dashboard", () => {
    const inSession: SearchHit = {
      ...base,
      type: SearchHitType.Goal,
      status: ItemStatus.InProgress,
      created_in_session_id: Some("sess-1"),
    };
    expect(searchHitHref(inSession)).toEqual(Some("/coaching-sessions/sess-1?panel=goals"));
    expect(searchHitHref({ ...inSession, created_in_session_id: None })).toEqual(
      Some("/dashboard")
    );
  });

  it("links actions to the actions panel with a highlight", () => {
    const hit: SearchHit = {
      ...base,
      type: SearchHitType.Action,
      coaching_session_id: Some("sess-1"),
      goal_id: None,
      status: ItemStatus.NotStarted,
      due_by: None,
      session_date: None,
      session_display_title: None,
    };
    expect(searchHitHref(hit)).toEqual(
      Some("/coaching-sessions/sess-1?panel=actions&highlight=hit-1")
    );
    expect(searchHitHref({ ...hit, coaching_session_id: None })).toEqual(Some("/actions"));
  });

  it("returns None for agreements and topics without a session", () => {
    const agreement: SearchHit = {
      ...base,
      type: SearchHitType.Agreement,
      coaching_session_id: None,
      session_date: None,
      session_display_title: None,
    };
    expect(searchHitHref(agreement).none).toBe(true);
    expect(searchHitHref({ ...agreement, coaching_session_id: Some("s") })).toEqual(
      Some("/coaching-sessions/s?panel=agreements")
    );

    const topic: SearchHit = {
      ...base,
      type: SearchHitType.Topic,
      coaching_session_id: Some("s"),
      status: TopicStatus.Open,
      priority: None,
    };
    expect(searchHitHref(topic)).toEqual(Some("/coaching-sessions/s"));
  });
});
