// FROZEN ACCEPTANCE TEST (overseer-handoff-workflow).
// Pins the Phase 3a contract for the Topics section: the presentational
// <TopicSectionContent> — list render, empty state, inline add, click-to-edit,
// and the load-bearing permission rule **delete is author-only**. Reorder
// (Phase 3b), rating chips (Phase 4), and provenance/"new" dot (Phase 5) are
// NOT part of this phase. Data wiring (Phase 1 hooks -> props, panel-switcher
// integration) lives in the data-connected section + panel host and is covered
// by a separate non-frozen test.
//
// Read-only (chmod 0444), on the freeze list: an IMPLEMENTER must NOT edit it.
// Only the overseer may unlock it for a genuine spec/harness error.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { defaultCoachingSessionTopic } from "@/types/coaching-session-topic";
import type { CoachingSessionTopic } from "@/types/coaching-session-topic";
import { TopicSectionContent } from "@/components/ui/coaching-sessions/topic-section-content";

const topic = (over: Partial<CoachingSessionTopic>): CoachingSessionTopic => ({
  ...defaultCoachingSessionTopic(),
  ...over,
});

const noop = () => {};

describe("TopicSectionContent — list + empty", () => {
  it("renders each topic body", () => {
    render(
      <TopicSectionContent
        topics={[
          topic({ id: "t1", user_id: "me", body: "Talk about the reorg" }),
          topic({ id: "t2", user_id: "them", body: "Discuss the promotion path" }),
        ]}
        viewerId="me"
        onCreate={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByText("Talk about the reorg")).toBeInTheDocument();
    expect(screen.getByText("Discuss the promotion path")).toBeInTheDocument();
  });

  it("shows an empty state when there are no topics", () => {
    render(
      <TopicSectionContent
        topics={[]}
        viewerId="me"
        onCreate={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByText(/no topics/i)).toBeInTheDocument();
  });
});

describe("TopicSectionContent — inline add", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a trimmed topic from the add input on Enter", () => {
    const onCreate = vi.fn();
    render(
      <TopicSectionContent
        topics={[]}
        viewerId="me"
        onCreate={onCreate}
        onEdit={noop}
        onDelete={noop}
      />
    );
    const input = screen.getByPlaceholderText(/add a topic/i);
    fireEvent.change(input, { target: { value: "  Prep for the review  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith("Prep for the review");
  });

  it("does not create an empty/whitespace topic", () => {
    const onCreate = vi.fn();
    render(
      <TopicSectionContent
        topics={[]}
        viewerId="me"
        onCreate={onCreate}
        onEdit={noop}
        onDelete={noop}
      />
    );
    const input = screen.getByPlaceholderText(/add a topic/i);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe("TopicSectionContent — click to edit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("commits an edited body via onEdit", () => {
    const onEdit = vi.fn();
    render(
      <TopicSectionContent
        topics={[topic({ id: "t1", user_id: "me", body: "Original body" })]}
        viewerId="me"
        onCreate={noop}
        onEdit={onEdit}
        onDelete={noop}
      />
    );
    fireEvent.click(screen.getByText("Original body"));
    const input = screen.getByRole("textbox", { name: /edit topic/i });
    fireEvent.change(input, { target: { value: "Edited body" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onEdit).toHaveBeenCalledWith("t1", "Edited body");
  });
});

describe("TopicSectionContent — delete is author-only", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a delete affordance on the viewer's own topic and fires onDelete", () => {
    const onDelete = vi.fn();
    render(
      <TopicSectionContent
        topics={[topic({ id: "t1", user_id: "me", body: "My topic" })]}
        viewerId="me"
        onCreate={noop}
        onEdit={noop}
        onDelete={onDelete}
      />
    );
    const del = screen.getByRole("button", { name: /delete topic/i });
    fireEvent.click(del);
    expect(onDelete).toHaveBeenCalledWith("t1");
  });

  it("does NOT render a delete affordance on another author's topic", () => {
    render(
      <TopicSectionContent
        topics={[topic({ id: "t2", user_id: "them", body: "Their topic" })]}
        viewerId="me"
        onCreate={noop}
        onEdit={noop}
        onDelete={vi.fn()}
      />
    );
    expect(
      screen.queryByRole("button", { name: /delete topic/i })
    ).not.toBeInTheDocument();
  });
});
