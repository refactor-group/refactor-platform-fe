import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { TranscriptStatusIndicator } from "@/components/ui/coaching-sessions/transcript-status-indicator";
import { IndicatorStatus } from "@/lib/transcript/indicator-status";

describe("TranscriptStatusIndicator", () => {
  it("renders nothing when status is None", () => {
    const { container } = render(
      <TranscriptStatusIndicator status={IndicatorStatus.None} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a red pulsing dot for Recording", () => {
    const { container } = render(
      <TranscriptStatusIndicator status={IndicatorStatus.Recording} />
    );
    const dot = container.firstChild as HTMLElement;
    expect(dot).not.toBeNull();
    expect(dot.className).toContain("bg-red-500");
    expect(dot.className).toContain("motion-safe:animate-pulse");
    expect(dot.className).toContain("rounded-full");
  });

  it("renders a solid green dot for TranscriptReady", () => {
    const { container } = render(
      <TranscriptStatusIndicator status={IndicatorStatus.TranscriptReady} />
    );
    const dot = container.firstChild as HTMLElement;
    expect(dot).not.toBeNull();
    expect(dot.className).toContain("bg-emerald-500");
    expect(dot.className).not.toContain("animate-pulse");
  });

  it("renders an alert glyph for Failed", () => {
    const { container } = render(
      <TranscriptStatusIndicator status={IndicatorStatus.Failed} />
    );
    // lucide icons render as <svg>, not a <span>
    const glyph = container.querySelector("svg");
    expect(glyph).not.toBeNull();
    expect(glyph?.getAttribute("class") ?? "").toContain("text-amber-500");
  });

  it("is decorative (aria-hidden) — parent button carries the label", () => {
    const { container } = render(
      <TranscriptStatusIndicator status={IndicatorStatus.Recording} />
    );
    const dot = container.firstChild as HTMLElement;
    expect(dot.getAttribute("aria-hidden")).toBe("true");
  });

  it("appends caller className", () => {
    const { container } = render(
      <TranscriptStatusIndicator
        status={IndicatorStatus.TranscriptReady}
        className="absolute top-1 right-1"
      />
    );
    const dot = container.firstChild as HTMLElement;
    expect(dot.className).toContain("absolute");
    expect(dot.className).toContain("top-1");
    expect(dot.className).toContain("right-1");
  });
});
