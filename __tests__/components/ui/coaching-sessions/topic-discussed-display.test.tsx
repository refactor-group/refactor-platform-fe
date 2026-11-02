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

describe("Topic row — Discussed display", () => {
  it("fades a Discussed topic's body without striking it through", () => {
    renderTopic(
      topic({ id: "t1", user_id: "me", body: "Wrapped this up", status: TopicStatus.Discussed })
    );
    const body = screen.getByText("Wrapped this up");
    expect(body).toHaveClass("text-muted-foreground/60");
    expect(body).not.toHaveClass("line-through");
  });

  it("leaves an Open topic's body at full strength", () => {
    renderTopic(
      topic({ id: "t1", user_id: "me", body: "Still to discuss", status: TopicStatus.Open })
    );
    expect(screen.getByText("Still to discuss")).not.toHaveClass("text-muted-foreground/60");
  });

  it("leaves a Deferred topic's body at full strength", () => {
    renderTopic(
      topic({ id: "t1", user_id: "me", body: "Punted forward", status: TopicStatus.Deferred })
    );
    expect(screen.getByText("Punted forward")).not.toHaveClass("text-muted-foreground/60");
  });
});
