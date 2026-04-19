import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useCoachingSessionLayout } from "../use-coaching-session-layout";
import { FocusedPanel } from "@/types/coaching-session-layout";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

const mockReplace = vi.fn();

function setUrl(pathname: string, search = ""): void {
  vi.mocked(usePathname).mockReturnValue(pathname);
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams(search) as never
  );
}

function getLastReplaceUrl(): string {
  const last = mockReplace.mock.calls.at(-1);
  if (!last) throw new Error("router.replace was not called");
  return last[0] as string;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({ replace: mockReplace } as never);
  setUrl("/coaching-sessions/abc");
});

describe("useCoachingSessionLayout — URL reading", () => {
  it("returns default state for an empty URL", () => {
    const { result } = renderHook(() => useCoachingSessionLayout());
    expect(result.current.focusedPanel).toBe(FocusedPanel.None);
    expect(result.current.isTranscriptOpen).toBe(false);
    expect(result.current.isGoalsCollapsed).toBe(false);
    expect(result.current.isNotesMaximized).toBe(false);
    expect(result.current.isTranscriptMaximized).toBe(false);
  });

  it("recognizes ?transcript=1 as open and collapses Goals", () => {
    setUrl("/coaching-sessions/abc", "transcript=1");
    const { result } = renderHook(() => useCoachingSessionLayout());
    expect(result.current.isTranscriptOpen).toBe(true);
    expect(result.current.isGoalsCollapsed).toBe(true);
  });

  it("recognizes ?focus=notes as Notes maximized", () => {
    setUrl("/coaching-sessions/abc", "focus=notes");
    const { result } = renderHook(() => useCoachingSessionLayout());
    expect(result.current.focusedPanel).toBe(FocusedPanel.Notes);
    expect(result.current.isNotesMaximized).toBe(true);
    expect(result.current.isGoalsCollapsed).toBe(true);
  });

  it("recognizes ?focus=transcript as Transcript maximized", () => {
    setUrl("/coaching-sessions/abc", "focus=transcript&transcript=1");
    const { result } = renderHook(() => useCoachingSessionLayout());
    expect(result.current.focusedPanel).toBe(FocusedPanel.Transcript);
    expect(result.current.isTranscriptMaximized).toBe(true);
    expect(result.current.isTranscriptOpen).toBe(true);
  });

  it("ignores invalid ?focus values and falls back to None", () => {
    setUrl("/coaching-sessions/abc", "focus=bogus");
    const { result } = renderHook(() => useCoachingSessionLayout());
    expect(result.current.focusedPanel).toBe(FocusedPanel.None);
  });
});

describe("useCoachingSessionLayout — URL writing", () => {
  it("openTranscript adds ?transcript=1", () => {
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.openTranscript());
    expect(getLastReplaceUrl()).toBe("/coaching-sessions/abc?transcript=1");
  });

  it("openTranscript clears Notes-focused mode so the pane is visible", () => {
    setUrl("/coaching-sessions/abc", "focus=notes");
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.openTranscript());
    expect(getLastReplaceUrl()).toBe("/coaching-sessions/abc?transcript=1");
  });

  it("closeTranscript strips ?transcript=1 and clears transcript-focused mode", () => {
    setUrl("/coaching-sessions/abc", "focus=transcript&transcript=1");
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.closeTranscript());
    expect(getLastReplaceUrl()).toBe("/coaching-sessions/abc");
  });

  it("closeTranscript preserves ?focus=notes (unrelated focus)", () => {
    setUrl("/coaching-sessions/abc", "focus=notes&transcript=1");
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.closeTranscript());
    expect(getLastReplaceUrl()).toBe("/coaching-sessions/abc?focus=notes");
  });

  it("toggleNotesMaximized turns on Notes focus and preserves open transcript state", () => {
    setUrl("/coaching-sessions/abc", "transcript=1");
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.toggleNotesMaximized());
    const url = getLastReplaceUrl();
    expect(url).toContain("focus=notes");
    expect(url).toContain("transcript=1");
  });

  it("toggleNotesMaximized doesn't open the transcript when it wasn't open", () => {
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.toggleNotesMaximized());
    expect(getLastReplaceUrl()).toBe("/coaching-sessions/abc?focus=notes");
  });

  it("toggleNotesMaximized restores 3-col layout when unmaximizing with transcript still open", () => {
    setUrl("/coaching-sessions/abc", "focus=notes&transcript=1");
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.toggleNotesMaximized());
    expect(getLastReplaceUrl()).toBe("/coaching-sessions/abc?transcript=1");
  });

  it("toggleNotesMaximized restores clean state when unmaximizing without transcript", () => {
    setUrl("/coaching-sessions/abc", "focus=notes");
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.toggleNotesMaximized());
    expect(getLastReplaceUrl()).toBe("/coaching-sessions/abc");
  });

  it("toggleTranscriptMaximized turns on Transcript focus and keeps pane open", () => {
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.toggleTranscriptMaximized());
    const url = getLastReplaceUrl();
    expect(url).toContain("focus=transcript");
    expect(url).toContain("transcript=1");
  });

  it("toggleTranscriptMaximized restores and leaves the pane open", () => {
    setUrl("/coaching-sessions/abc", "focus=transcript&transcript=1");
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.toggleTranscriptMaximized());
    expect(getLastReplaceUrl()).toBe("/coaching-sessions/abc?transcript=1");
  });

  it("preserves unrelated URL params like ?panel=actions", () => {
    setUrl("/coaching-sessions/abc", "panel=actions");
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.openTranscript());
    const url = getLastReplaceUrl();
    expect(url).toContain("panel=actions");
    expect(url).toContain("transcript=1");
  });
});

describe("useCoachingSessionLayout — Goals collapse override", () => {
  it("user can expand Goals even while the transcript is open", () => {
    setUrl("/coaching-sessions/abc", "transcript=1");
    const { result } = renderHook(() => useCoachingSessionLayout());
    expect(result.current.isGoalsCollapsed).toBe(true);

    act(() => result.current.toggleGoalsCollapsed());
    expect(result.current.isGoalsCollapsed).toBe(false);
  });

  it("user can collapse Goals even when there's no transcript or focus mode", () => {
    const { result } = renderHook(() => useCoachingSessionLayout());
    expect(result.current.isGoalsCollapsed).toBe(false);

    act(() => result.current.toggleGoalsCollapsed());
    expect(result.current.isGoalsCollapsed).toBe(true);
  });

  it("collapsing Goals from the default state auto-maximizes Notes (the only other panel)", () => {
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.toggleGoalsCollapsed());
    expect(getLastReplaceUrl()).toBe("/coaching-sessions/abc?focus=notes");
  });

  it("collapsing Goals in the 3-col docked state does not auto-maximize", () => {
    setUrl("/coaching-sessions/abc", "transcript=1");
    const { result } = renderHook(() => useCoachingSessionLayout());
    // Goals is already collapsed by default here; expand first, then collapse.
    act(() => result.current.toggleGoalsCollapsed()); // expand
    act(() => result.current.toggleGoalsCollapsed()); // collapse again
    // writeLayout should not have been called to set a focus mode.
    for (const call of mockReplace.mock.calls) {
      expect(call[0] as string).not.toContain("focus=");
    }
  });

  it("expanding Goals from a focused state exits focus mode (mirror of auto-maximize)", () => {
    setUrl("/coaching-sessions/abc", "focus=notes");
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.toggleGoalsCollapsed()); // expand
    expect(getLastReplaceUrl()).toBe("/coaching-sessions/abc");
  });

  it("expanding Goals in the 3-col docked state leaves the URL alone", () => {
    setUrl("/coaching-sessions/abc", "transcript=1");
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.toggleGoalsCollapsed()); // expand
    // Expanding in 3-col docked shouldn't call writeLayout at all — no
    // focus mode to exit, and transcript open state shouldn't flip.
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("expanding Goals from transcript-maximized returns to goals+transcript docked", () => {
    setUrl("/coaching-sessions/abc", "focus=transcript&transcript=1");
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.toggleGoalsCollapsed()); // expand
    expect(getLastReplaceUrl()).toBe("/coaching-sessions/abc?transcript=1");
  });
});
