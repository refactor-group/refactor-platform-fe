// FROZEN ACCEPTANCE TEST (overseer-handoff-workflow).
// Pins the Phase 5 contract for topic provenance + the "new since last session"
// dot: the pure decision helpers `isTopicNew` / `topicWasUpdated`, and the dot's
// accessibility (an `sr-only` "New since your last session" label that is
// present/absent by MEANING, not hue — per the plan, accessibility comes from
// presence + text, so the color is swappable). The previous-session anchor is
// FE-derived and passed in as `previousSessionDate: Option<DateTime>`. The
// Radix HoverCard *content* (name + Added/Updated relative times) is not
// asserted here (it only renders on hover); it's covered by review.
//
// Read-only (chmod 0444), on the freeze list: an IMPLEMENTER must NOT edit it.
// Only the overseer may unlock it for a genuine spec/harness error.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DateTime } from "ts-luxon";
import { Some, None } from "@/types/option";
import {
  defaultCoachingSessionTopic,
  isTopicNew,
  topicWasUpdated,
} from "@/types/coaching-session-topic";
import type { CoachingSessionTopic } from "@/types/coaching-session-topic";
import { TopicAuthorBadge } from "@/components/ui/coaching-sessions/topic-provenance";

const PREV = DateTime.fromISO("2026-05-31T17:00:00Z");
const AFTER = DateTime.fromISO("2026-06-05T09:00:00Z"); // after PREV
const BEFORE = DateTime.fromISO("2026-05-20T09:00:00Z"); // before PREV

const topic = (over: Partial<CoachingSessionTopic>): CoachingSessionTopic => ({
  ...defaultCoachingSessionTopic(),
  ...over,
});

describe("isTopicNew — created after the previous session, by the OTHER party", () => {
  it("is true when created after previous session and authored by someone else", () => {
    expect(
      isTopicNew(topic({ user_id: "them", created_at: AFTER }), "me", Some(PREV))
    ).toBe(true);
  });

  it("is false for the viewer's own topic (even if created after the previous session)", () => {
    expect(
      isTopicNew(topic({ user_id: "me", created_at: AFTER }), "me", Some(PREV))
    ).toBe(false);
  });

  it("is false when created before the previous session", () => {
    expect(
      isTopicNew(topic({ user_id: "them", created_at: BEFORE }), "me", Some(PREV))
    ).toBe(false);
  });

  it("is false when there is no previous session (None)", () => {
    expect(
      isTopicNew(topic({ user_id: "them", created_at: AFTER }), "me", None)
    ).toBe(false);
  });
});

describe("topicWasUpdated — updated strictly after created", () => {
  it("is true when updated_at is after created_at", () => {
    expect(
      topicWasUpdated(topic({ created_at: BEFORE, updated_at: AFTER }))
    ).toBe(true);
  });

  it("is false when updated_at equals created_at", () => {
    expect(
      topicWasUpdated(topic({ created_at: AFTER, updated_at: AFTER }))
    ).toBe(false);
  });
});

describe("TopicAuthorBadge — 'new since last visit' dot accessibility", () => {
  it("renders an sr-only 'New since your last visit' label when the topic is new", () => {
    render(
      <TopicAuthorBadge
        authorName="Alex Chen"
        authorId="them"
        viewerId="me"
        createdAt={AFTER}
        updatedAt={AFTER}
        lastViewedAt={Some(PREV)}
      />
    );
    expect(
      screen.getByText(/new since your last visit/i)
    ).toBeInTheDocument();
  });

  it("does NOT render the 'new' label for the viewer's own topic", () => {
    render(
      <TopicAuthorBadge
        authorName="Me"
        authorId="me"
        viewerId="me"
        createdAt={AFTER}
        updatedAt={AFTER}
        lastViewedAt={Some(PREV)}
      />
    );
    expect(
      screen.queryByText(/new since your last visit/i)
    ).not.toBeInTheDocument();
  });

  it("does NOT render the 'new' label when never viewed (None)", () => {
    render(
      <TopicAuthorBadge
        authorName="Alex Chen"
        authorId="them"
        viewerId="me"
        createdAt={AFTER}
        updatedAt={AFTER}
        lastViewedAt={None}
      />
    );
    expect(
      screen.queryByText(/new since your last visit/i)
    ).not.toBeInTheDocument();
  });
});
