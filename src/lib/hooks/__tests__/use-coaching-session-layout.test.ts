import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useCoachingSessionLayout } from "../use-coaching-session-layout";
import { FocusedPane } from "@/types/coaching-session-layout";

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
    expect(result.current.focusedPane).toBe(FocusedPane.None);
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
    expect(result.current.focusedPane).toBe(FocusedPane.Notes);
    expect(result.current.isNotesMaximized).toBe(true);
    expect(result.current.isGoalsCollapsed).toBe(true);
  });

  it("recognizes ?focus=transcript as Transcript maximized", () => {
    setUrl("/coaching-sessions/abc", "focus=transcript&transcript=1");
    const { result } = renderHook(() => useCoachingSessionLayout());
    expect(result.current.focusedPane).toBe(FocusedPane.Transcript);
    expect(result.current.isTranscriptMaximized).toBe(true);
    expect(result.current.isTranscriptOpen).toBe(true);
  });

  it("ignores invalid ?focus values and falls back to None", () => {
    setUrl("/coaching-sessions/abc", "focus=bogus");
    const { result } = renderHook(() => useCoachingSessionLayout());
    expect(result.current.focusedPane).toBe(FocusedPane.None);
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

  it("toggleNotesMaximized turns on Notes focus and closes the transcript", () => {
    setUrl("/coaching-sessions/abc", "transcript=1");
    const { result } = renderHook(() => useCoachingSessionLayout());
    act(() => result.current.toggleNotesMaximized());
    expect(getLastReplaceUrl()).toBe("/coaching-sessions/abc?focus=notes");
  });

  it("toggleNotesMaximized restores when already maximized", () => {
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
