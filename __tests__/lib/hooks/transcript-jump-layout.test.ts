// Opening the transcript from a suggestion keeps the Actions panel expanded.

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutShape,
  type LayoutState,
  afterOpenTranscriptKeepingPanel,
  useCoachingSessionLayout,
} from "@/lib/hooks/use-coaching-session-layout";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

const mockReplace = vi.fn();

function setUrl(search = ""): void {
  vi.mocked(usePathname).mockReturnValue("/coaching-sessions/abc");
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(search) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ replace: mockReplace } as never);
  setUrl();
});

const DOCKED_EXPANDED: LayoutState = { shape: LayoutShape.Docked, goalsExpanded: true };

describe("afterOpenTranscriptKeepingPanel", () => {
  it("docks the transcript with the panel expanded", () => {
    expect(afterOpenTranscriptKeepingPanel({ shape: LayoutShape.Default })).toEqual(
      DOCKED_EXPANDED
    );
    expect(
      afterOpenTranscriptKeepingPanel({ shape: LayoutShape.NotesMaximized, transcriptPending: false })
    ).toEqual(DOCKED_EXPANDED);
    expect(
      afterOpenTranscriptKeepingPanel({ shape: LayoutShape.NotesMaximized, transcriptPending: true })
    ).toEqual(DOCKED_EXPANDED);
  });

  it("expands a collapsed docked panel", () => {
    expect(
      afterOpenTranscriptKeepingPanel({ shape: LayoutShape.Docked, goalsExpanded: false })
    ).toEqual(DOCKED_EXPANDED);
    expect(afterOpenTranscriptKeepingPanel(DOCKED_EXPANDED)).toEqual(DOCKED_EXPANDED);
  });

  it("leaves a maximized transcript alone", () => {
    expect(afterOpenTranscriptKeepingPanel({ shape: LayoutShape.TranscriptMaximized })).toEqual({
      shape: LayoutShape.TranscriptMaximized,
    });
  });
});

describe("openTranscriptKeepingPanel", () => {
  it("opens the transcript and the panel stays expanded once the URL updates", () => {
    const { result, rerender } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.openTranscriptKeepingPanel());
    expect(mockReplace.mock.calls.at(-1)?.[0]).toContain("transcript=1");

    setUrl("transcript=1");
    rerender();
    expect(result.current.isTranscriptOpen).toBe(true);
    expect(result.current.isGoalsCollapsed).toBe(false);
  });

  it("leaves the existing open path collapsing the panel", () => {
    const { result, rerender } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.openTranscript());
    setUrl("transcript=1");
    rerender();
    expect(result.current.isGoalsCollapsed).toBe(true);
  });
});
