import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { TranscriptSearch } from "@/components/ui/coaching-sessions/transcript-search";

function renderSearch(overrides: Partial<React.ComponentProps<typeof TranscriptSearch>> = {}) {
  const props = {
    query: "",
    onQueryChange: vi.fn(),
    totalMatches: 0,
    activeIndex: 0,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  const utils = render(<TranscriptSearch {...props} />);
  return { ...utils, props };
}

describe("TranscriptSearch — input", () => {
  it("shows only the input and icon when the query is empty", () => {
    renderSearch();
    expect(screen.getByRole("textbox", { name: "Search transcript" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next match" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous match" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("forwards typed input via onQueryChange", () => {
    const { props } = renderSearch();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "cohort" } });
    expect(props.onQueryChange).toHaveBeenCalledWith("cohort");
  });

  it("renders the controls cluster once the query is non-empty", () => {
    renderSearch({ query: "cohort", totalMatches: 3, activeIndex: 0 });
    expect(screen.getByRole("button", { name: "Next match" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous match" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
  });
});

describe("TranscriptSearch — counter", () => {
  it('shows "0" when there are no matches', () => {
    renderSearch({ query: "nada", totalMatches: 0, activeIndex: 0 });
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("formats the counter as n/total (1-based)", () => {
    renderSearch({ query: "x", totalMatches: 12, activeIndex: 4 });
    expect(screen.getByText("5/12")).toBeInTheDocument();
  });

  it("disables prev/next when no matches", () => {
    renderSearch({ query: "x", totalMatches: 0, activeIndex: 0 });
    expect(screen.getByRole("button", { name: "Next match" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous match" })).toBeDisabled();
  });

  it("enables prev/next when there are matches", () => {
    renderSearch({ query: "x", totalMatches: 2, activeIndex: 0 });
    expect(screen.getByRole("button", { name: "Next match" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous match" })).not.toBeDisabled();
  });
});

describe("TranscriptSearch — button actions", () => {
  it("calls onNext when Next is clicked", () => {
    const { props } = renderSearch({ query: "x", totalMatches: 2, activeIndex: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Next match" }));
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onPrev when Previous is clicked", () => {
    const { props } = renderSearch({ query: "x", totalMatches: 2, activeIndex: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Previous match" }));
    expect(props.onPrev).toHaveBeenCalledTimes(1);
  });

  it("calls onClear when the clear button is clicked", () => {
    const { props } = renderSearch({ query: "x", totalMatches: 2, activeIndex: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });
});

describe("TranscriptSearch — keyboard", () => {
  it("Enter triggers onNext", () => {
    const { props } = renderSearch({ query: "x", totalMatches: 2, activeIndex: 0 });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect(props.onPrev).not.toHaveBeenCalled();
  });

  it("Shift+Enter triggers onPrev", () => {
    const { props } = renderSearch({ query: "x", totalMatches: 2, activeIndex: 0 });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", shiftKey: true });
    expect(props.onPrev).toHaveBeenCalledTimes(1);
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it("Escape triggers onClear", () => {
    const { props } = renderSearch({ query: "x", totalMatches: 2, activeIndex: 0 });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it("other keys are not intercepted", () => {
    const { props } = renderSearch({ query: "x", totalMatches: 2, activeIndex: 0 });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "a" });
    expect(props.onNext).not.toHaveBeenCalled();
    expect(props.onPrev).not.toHaveBeenCalled();
    expect(props.onClear).not.toHaveBeenCalled();
  });
});
