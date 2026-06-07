// FROZEN ACCEPTANCE TEST (overseer-handoff-workflow).
// These assertions define the Phase 1 contract for the CoachingSessionTopic
// data layer. This file is set read-only (chmod 0444) and is on the freeze
// list: an IMPLEMENTER must NOT edit it. Only the overseer may unlock it, and
// only to correct a genuine spec/harness error — never to fit the code.

import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import {
  TopicRelevance,
  TopicImmediacy,
  transformCoachingSessionTopic,
  defaultCoachingSessionTopic,
} from "@/types/coaching-session-topic";

describe("Topic rating enums — snake_case wire values (must match Rust serde)", () => {
  it("TopicRelevance values", () => {
    expect(TopicRelevance.Neutral).toBe("neutral");
    expect(TopicRelevance.Background).toBe("background");
    expect(TopicRelevance.WorthExploring).toBe("worth_exploring");
    expect(TopicRelevance.Central).toBe("central");
  });

  it("TopicImmediacy values", () => {
    expect(TopicImmediacy.Neutral).toBe("neutral");
    expect(TopicImmediacy.CanWait).toBe("can_wait");
    expect(TopicImmediacy.Soon).toBe("soon");
    expect(TopicImmediacy.Pressing).toBe("pressing");
  });
});

describe("transformCoachingSessionTopic", () => {
  const raw = {
    id: "t1",
    coaching_session_id: "s1",
    user_id: "u1",
    body: "Talk about the reorg",
    relevance: "worth_exploring",
    immediacy: "pressing",
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

  it("maps snake_case wire values onto the enum members", () => {
    const t = transformCoachingSessionTopic(raw);
    expect(t.relevance).toBe(TopicRelevance.WorthExploring);
    expect(t.immediacy).toBe(TopicImmediacy.Pressing);
  });

  it("does NOT expose display_order on the FE object (wire contract: backend-internal)", () => {
    const t = transformCoachingSessionTopic(raw);
    expect("display_order" in t).toBe(false);
  });

  it("defaults missing/unknown relevance and immediacy to Neutral (non-null field)", () => {
    const t = transformCoachingSessionTopic({
      ...raw,
      relevance: undefined,
      immediacy: "bogus_value",
    });
    expect(t.relevance).toBe(TopicRelevance.Neutral);
    expect(t.immediacy).toBe(TopicImmediacy.Neutral);
  });
});

describe("defaultCoachingSessionTopic", () => {
  it("returns Neutral ratings, empty identifiers, and DateTime timestamps", () => {
    const t = defaultCoachingSessionTopic();
    expect(t.relevance).toBe(TopicRelevance.Neutral);
    expect(t.immediacy).toBe(TopicImmediacy.Neutral);
    expect(t.id).toBe("");
    expect(t.coaching_session_id).toBe("");
    expect(t.user_id).toBe("");
    expect(t.body).toBe("");
    expect(t.created_at instanceof DateTime).toBe(true);
    expect(t.updated_at instanceof DateTime).toBe(true);
  });
});
