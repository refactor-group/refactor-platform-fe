// FROZEN ACCEPTANCE TEST (overseer-handoff-workflow).
// Pins the Phase 4 contract for the rating chip <TopicRatingChip>: enum-valued
// relevance/immediacy, a click-to-open popover, **coachee-only** editing
// (coach sees read-only), and **toggle-to-clear** (clicking the selected level
// sets it back to Neutral). Uses the real Phase 1 enums. The row integration +
// the update wiring are non-frozen.
//
// Read-only (chmod 0444), on the freeze list: an IMPLEMENTER must NOT edit it.
// Only the overseer may unlock it for a genuine spec/harness error.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopicRelevance, TopicImmediacy } from "@/types/coaching-session-topic";
import { TopicRatingChip } from "@/components/ui/coaching-sessions/topic-rating-chip";

describe("TopicRatingChip — display", () => {
  it("labels the chip with axis + current level when set", () => {
    render(
      <TopicRatingChip
        axis="relevance"
        value={TopicRelevance.Central}
        editable
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /relevance: central/i })
    ).toBeInTheDocument();
  });

  it("labels an unset chip as Unrated", () => {
    render(
      <TopicRatingChip
        axis="immediacy"
        value={TopicImmediacy.Neutral}
        editable
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /immediacy: unrated/i })
    ).toBeInTheDocument();
  });
});

describe("TopicRatingChip — coachee can set / toggle-to-clear", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens a popover with the axis subtitle on click", () => {
    render(
      <TopicRatingChip
        axis="relevance"
        value={TopicRelevance.Neutral}
        editable
        onChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /relevance/i }));
    expect(
      screen.getByText(/how relevant is this topic to you today\?/i)
    ).toBeInTheDocument();
  });

  it("sets a level when the coachee picks one", () => {
    const onChange = vi.fn();
    render(
      <TopicRatingChip
        axis="relevance"
        value={TopicRelevance.Neutral}
        editable
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /relevance/i }));
    fireEvent.click(screen.getByRole("button", { name: "Worth exploring" }));
    expect(onChange).toHaveBeenCalledWith(TopicRelevance.WorthExploring);
  });

  it("clears to Neutral when the coachee clicks the already-selected level", () => {
    const onChange = vi.fn();
    render(
      <TopicRatingChip
        axis="immediacy"
        value={TopicImmediacy.Pressing}
        editable
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /immediacy: pressing/i }));
    fireEvent.click(screen.getByRole("button", { name: "Pressing" }));
    expect(onChange).toHaveBeenCalledWith(TopicImmediacy.Neutral);
  });
});

describe("TopicRatingChip — coach is read-only", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers no level chooser and never calls onChange", () => {
    const onChange = vi.fn();
    render(
      <TopicRatingChip
        axis="immediacy"
        value={TopicImmediacy.Soon}
        editable={false}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /immediacy: soon/i }));
    // Read-only popover: a "set by the coachee" hint, and NO clickable level option.
    expect(screen.getByText(/set by the coachee/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Soon" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pressing" })
    ).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
