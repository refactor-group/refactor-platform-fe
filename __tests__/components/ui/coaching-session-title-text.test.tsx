import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Some, None } from "@/types/option";
import { CoachingSessionTitleText } from "@/components/ui/coaching-session-title-text";

// The derivation rule itself is covered by coaching-session-title.test.ts.
// These tests cover only what the component adds: the `hideWhenRedundantWithGoals`
// guard and className pass-through.
describe("CoachingSessionTitleText", () => {
  it("renders the human-set title", () => {
    render(
      <CoachingSessionTitleText session={{ title: Some("Q3 planning") }} />
    );
    expect(screen.getByText("Q3 planning")).toBeInTheDocument();
  });

  it("applies the passed className to the rendered element", () => {
    render(
      <CoachingSessionTitleText
        session={{ title: Some("Q3 planning") }}
        className="text-xs text-muted-foreground"
      />
    );
    expect(screen.getByText("Q3 planning")).toHaveClass(
      "text-xs",
      "text-muted-foreground"
    );
  });

  it("renders nothing when the title only echoes a goal already shown (hideWhenRedundantWithGoals)", () => {
    const { container } = render(
      <CoachingSessionTitleText
        session={{
          title: None,
          goals: [{ title: "Improve technical leadership" }],
        }}
        hideWhenRedundantWithGoals
      />
    );
    // Title falls back to the first goal, which is already displayed elsewhere,
    // so the component suppresses the duplicate line.
    expect(
      screen.queryByText("Improve technical leadership")
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("still renders a human title distinct from the goals when hideWhenRedundantWithGoals is set", () => {
    render(
      <CoachingSessionTitleText
        session={{
          title: Some("Career growth check-in"),
          goals: [{ title: "Improve technical leadership" }],
        }}
        hideWhenRedundantWithGoals
      />
    );
    expect(screen.getByText("Career growth check-in")).toBeInTheDocument();
  });

  it("renders a topic-derived title even when goals exist, since it is not a goal echo", () => {
    render(
      <CoachingSessionTitleText
        session={{
          title: None,
          topics: [{ body: "Delegation struggles" }],
          goals: [{ title: "Improve technical leadership" }],
        }}
        hideWhenRedundantWithGoals
      />
    );
    expect(screen.getByText("Delegation struggles")).toBeInTheDocument();
  });
});
