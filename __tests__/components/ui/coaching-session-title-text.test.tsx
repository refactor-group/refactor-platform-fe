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

  it("renders a <p> by default and a <span> when as='span' (for button hosts)", () => {
    const { rerender } = render(
      <CoachingSessionTitleText session={{ title: Some("Q3 planning") }} />
    );
    expect(screen.getByText("Q3 planning").tagName).toBe("P");

    rerender(
      <CoachingSessionTitleText session={{ title: Some("Q3 planning") }} as="span" />
    );
    expect(screen.getByText("Q3 planning").tagName).toBe("SPAN");
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

  it("prefers the backend display_title verbatim over the client derivation", () => {
    render(
      <CoachingSessionTitleText
        session={{
          // Client rule would pick the topic; display_title must win.
          title: None,
          display_title: Some("Server-composed title"),
          topics: [{ body: "Delegation struggles" }],
        }}
      />
    );
    expect(screen.getByText("Server-composed title")).toBeInTheDocument();
    expect(screen.queryByText("Delegation struggles")).not.toBeInTheDocument();
  });

  it("shows the fallback when display_title is present but None", () => {
    render(
      <CoachingSessionTitleText session={{ title: None, display_title: None }} />
    );
    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  it("uses a custom fallbackTitle when nothing can be derived", () => {
    render(
      <CoachingSessionTitleText
        session={{ title: None, display_title: None }}
        fallbackTitle="Untitled session"
      />
    );
    expect(screen.getByText("Untitled session")).toBeInTheDocument();
  });

  it("renders nothing when nothing derives and hideWhenFallback is set", () => {
    const { container } = render(
      <CoachingSessionTitleText
        session={{ title: None, display_title: None }}
        hideWhenFallback
      />
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Untitled")).not.toBeInTheDocument();
  });

  it("still renders a derived title when hideWhenFallback is set", () => {
    render(
      <CoachingSessionTitleText
        session={{ title: None, display_title: Some("Server title") }}
        hideWhenFallback
      />
    );
    expect(screen.getByText("Server title")).toBeInTheDocument();
  });

  it("hideWhenFallback also omits the client-derived fallback (no display_title)", () => {
    const { container } = render(
      <CoachingSessionTitleText session={{ title: None }} hideWhenFallback />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("falls back to the client derivation when display_title is absent", () => {
    // display_title undefined (e.g. the single-session read) -> client rule.
    render(
      <CoachingSessionTitleText
        session={{ title: None, goals: [{ title: "Improve technical leadership" }] }}
      />
    );
    expect(
      screen.getByText("Improve technical leadership")
    ).toBeInTheDocument();
  });
});
