// FROZEN ACCEPTANCE TEST (overseer-handoff-workflow).
// Pins the contract for topic provenance + the "new since your last visit" dot:
// the pure decision helpers `isTopicNew` / `topicWasUpdated`, and the dot's
// accessibility (an `sr-only` "New since your last visit" label that is
// present/absent by MEANING, not hue — accessibility comes from presence +
// text, so the color is swappable).
//
// The anchor is a three-state `LastViewedAnchor` derived FE-side from the
// per-session last-viewed marker:
//  - loading: marker not fetched yet → nothing is new (no flash).
//  - never:   never viewed → every OTHER-authored topic is new (incl. ones
//             added before this first open).
//  - viewed:  viewed at an instant → new = other-authored, created after it.
// The Radix HoverCard *content* (name + Added/Updated relative times) is not
// asserted here (it only renders on hover); it's covered by review.
//
// Read-only (chmod 0444), on the freeze list: an IMPLEMENTER must NOT edit it.
// Only the overseer may unlock it for a genuine spec/harness error.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DateTime } from "ts-luxon";
import {
  defaultCoachingSessionTopic,
  isTopicNew,
  topicWasUpdated,
  type LastViewedAnchor,
} from "@/types/coaching-session-topic";
import type { CoachingSessionTopic } from "@/types/coaching-session-topic";
import { TopicAuthorBadge } from "@/components/ui/coaching-sessions/topic-provenance";

const PREV = DateTime.fromISO("2026-05-31T17:00:00Z");
const AFTER = DateTime.fromISO("2026-06-05T09:00:00Z"); // after PREV
const BEFORE = DateTime.fromISO("2026-05-20T09:00:00Z"); // before PREV

const VIEWED: LastViewedAnchor = { kind: "viewed", at: PREV };
const NEVER: LastViewedAnchor = { kind: "never" };
const LOADING: LastViewedAnchor = { kind: "loading" };

const topic = (over: Partial<CoachingSessionTopic>): CoachingSessionTopic => ({
  ...defaultCoachingSessionTopic(),
  ...over,
});

describe("isTopicNew — unseen by the viewer, authored by the OTHER party", () => {
  it("is true when created after the last-viewed marker and authored by someone else", () => {
    expect(
      isTopicNew(topic({ user_id: "them", created_at: AFTER }), "me", VIEWED)
    ).toBe(true);
  });

  it("is false for the viewer's own topic (even if created after the marker)", () => {
    expect(
      isTopicNew(topic({ user_id: "me", created_at: AFTER }), "me", VIEWED)
    ).toBe(false);
  });

  it("is false when created before the last-viewed marker", () => {
    expect(
      isTopicNew(topic({ user_id: "them", created_at: BEFORE }), "me", VIEWED)
    ).toBe(false);
  });

  it("is true for the other party's topic on a never-viewed session (any created_at)", () => {
    expect(
      isTopicNew(topic({ user_id: "them", created_at: BEFORE }), "me", NEVER)
    ).toBe(true);
  });

  it("is false for the viewer's own topic on a never-viewed session", () => {
    expect(
      isTopicNew(topic({ user_id: "me", created_at: AFTER }), "me", NEVER)
    ).toBe(false);
  });

  it("is false while the anchor is still loading (no flash)", () => {
    expect(
      isTopicNew(topic({ user_id: "them", created_at: AFTER }), "me", LOADING)
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

describe("TopicAuthorBadge — 'new since your last visit' dot accessibility", () => {
  it("renders an sr-only 'New since your last visit' label when the topic is new", () => {
    render(
      <TopicAuthorBadge
        authorName="Alex Chen"
        authorId="them"
        viewerId="me"
        createdAt={AFTER}
        updatedAt={AFTER}
        viewedAnchor={VIEWED}
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
        viewedAnchor={VIEWED}
      />
    );
    expect(
      screen.queryByText(/new since your last visit/i)
    ).not.toBeInTheDocument();
  });

  it("renders the 'new' label for the other party's topic on a never-viewed session", () => {
    render(
      <TopicAuthorBadge
        authorName="Alex Chen"
        authorId="them"
        viewerId="me"
        createdAt={AFTER}
        updatedAt={AFTER}
        viewedAnchor={NEVER}
      />
    );
    expect(
      screen.getByText(/new since your last visit/i)
    ).toBeInTheDocument();
  });

  it("does NOT render the 'new' label while the anchor is still loading", () => {
    render(
      <TopicAuthorBadge
        authorName="Alex Chen"
        authorId="them"
        viewerId="me"
        createdAt={AFTER}
        updatedAt={AFTER}
        viewedAnchor={LOADING}
      />
    );
    expect(
      screen.queryByText(/new since your last visit/i)
    ).not.toBeInTheDocument();
  });
});
