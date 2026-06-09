// Covers the Discussed visual signal in a topic row: the body is struck
// through when status === Discussed, and not otherwise. (The toggle behavior
// itself lives in topic-status-controls.test.tsx; this asserts the rendered
// strike-through, which nothing else covers.)

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  defaultCoachingSessionTopic,
  TopicStatus,
} from "@/types/coaching-session-topic";
import type { CoachingSessionTopic } from "@/types/coaching-session-topic";
import { TopicSectionContent } from "@/components/ui/coaching-sessions/topic-section-content";

const topic = (over: Partial<CoachingSessionTopic>): CoachingSessionTopic => ({
  ...defaultCoachingSessionTopic(),
  ...over,
});

const noop = () => {};

function renderTopic(t: CoachingSessionTopic) {
  return render(
    <TopicSectionContent
      topics={[t]}
      viewerId="me"
      onCreate={noop}
      onEdit={noop}
      onDelete={noop}
    />
  );
}

describe("Topic row — Discussed strike-through", () => {
  it("strikes through a Discussed topic's body", () => {
    renderTopic(
      topic({ id: "t1", user_id: "me", body: "Wrapped this up", status: TopicStatus.Discussed })
    );
    expect(screen.getByText("Wrapped this up").className).toContain("line-through");
  });

  it("does not strike through an Open topic's body", () => {
    renderTopic(
      topic({ id: "t1", user_id: "me", body: "Still to discuss", status: TopicStatus.Open })
    );
    expect(screen.getByText("Still to discuss").className).not.toContain("line-through");
  });

  it("does not strike through a Deferred topic's body", () => {
    renderTopic(
      topic({ id: "t1", user_id: "me", body: "Punted forward", status: TopicStatus.Deferred })
    );
    expect(screen.getByText("Punted forward").className).not.toContain("line-through");
  });
});
