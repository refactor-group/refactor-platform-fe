// ACCEPTANCE TEST — re-baselined to the CoachingSessionTopics v4 contract
// (single `priority` + `status` lifecycle; `relevance`/`immediacy` removed).
// Defines the contract for the CoachingSessionTopic data layer.

import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import {
  TopicPriority,
  TopicStatus,
  transformCoachingSessionTopic,
  defaultCoachingSessionTopic,
} from "@/types/coaching-session-topic";

describe("Topic enums — PascalCase wire values (must match Rust serde)", () => {
  it("TopicPriority values", () => {
    expect(TopicPriority.Low).toBe("Low");
    expect(TopicPriority.Medium).toBe("Medium");
    expect(TopicPriority.High).toBe("High");
  });

  it("TopicStatus values", () => {
    expect(TopicStatus.Open).toBe("Open");
    expect(TopicStatus.Discussed).toBe("Discussed");
    expect(TopicStatus.Deferred).toBe("Deferred");
  });
});

describe("transformCoachingSessionTopic", () => {
  const raw = {
    id: "t1",
    coaching_session_id: "s1",
    user_id: "u1",
    body: "Talk about the reorg",
    priority: "High",
    status: "Discussed",
    moved_from_session_id: "s0",
    display_order: 4,
    created_at: "2026-06-05T09:00:00Z",
    updated_at: "2026-06-07T13:00:00Z",
  };

  it("converts created_at/updated_at ISO strings to valid ts-luxon DateTime", () => {
    const t = transformCoachingSessionTopic(raw);
    expect(t.created_at instanceof DateTime).toBe(true);
    expect(t.updated_at instanceof DateTime).toBe(true);
    expect(t.created_at.isValid).toBe(true);
    expect(t.updated_at.isValid).toBe(true);
  });

  it("maps a set priority onto Some(enum)", () => {
    const t = transformCoachingSessionTopic(raw);
    expect(t.priority.some).toBe(true);
    expect(t.priority.some && t.priority.val).toBe(TopicPriority.High);
  });

  it("maps the status wire value onto the enum", () => {
    const t = transformCoachingSessionTopic(raw);
    expect(t.status).toBe(TopicStatus.Discussed);
  });

  it("wraps a present moved_from_session_id in Some", () => {
    const t = transformCoachingSessionTopic(raw);
    expect(t.moved_from_session_id.some).toBe(true);
    expect(t.moved_from_session_id.some && t.moved_from_session_id.val).toBe(
      "s0"
    );
  });

  it("does NOT expose display_order on the FE object (backend-internal)", () => {
    const t = transformCoachingSessionTopic(raw);
    expect("display_order" in t).toBe(false);
  });

  it("treats null/absent/unknown priority as None (unset)", () => {
    expect(transformCoachingSessionTopic({ ...raw, priority: null }).priority.some).toBe(
      false
    );
    expect(
      transformCoachingSessionTopic({ ...raw, priority: undefined }).priority.some
    ).toBe(false);
    expect(
      transformCoachingSessionTopic({ ...raw, priority: "bogus" }).priority.some
    ).toBe(false);
  });

  it("defaults missing/unknown status to Open", () => {
    expect(transformCoachingSessionTopic({ ...raw, status: undefined }).status).toBe(
      TopicStatus.Open
    );
    expect(transformCoachingSessionTopic({ ...raw, status: "bogus" }).status).toBe(
      TopicStatus.Open
    );
  });

  it("treats null/absent moved_from_session_id as None", () => {
    expect(
      transformCoachingSessionTopic({ ...raw, moved_from_session_id: null })
        .moved_from_session_id.some
    ).toBe(false);
  });
});

describe("defaultCoachingSessionTopic", () => {
  it("returns unset priority, Open status, no move-origin, and DateTime timestamps", () => {
    const t = defaultCoachingSessionTopic();
    expect(t.priority.some).toBe(false);
    expect(t.status).toBe(TopicStatus.Open);
    expect(t.moved_from_session_id.some).toBe(false);
    expect(t.id).toBe("");
    expect(t.coaching_session_id).toBe("");
    expect(t.user_id).toBe("");
    expect(t.body).toBe("");
    expect(t.created_at instanceof DateTime).toBe(true);
    expect(t.updated_at instanceof DateTime).toBe(true);
  });
});
