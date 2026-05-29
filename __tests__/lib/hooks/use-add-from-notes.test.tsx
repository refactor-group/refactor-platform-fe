import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useAddFromNotes } from "@/lib/hooks/use-add-from-notes";
import { PanelSection } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";

// The hook owns the selection state + nonce + the "pin section once per nonce
// when expanded" effect. It delegates the URL write to the injected
// `pinSection` and the panel expansion to `toggleGoalsCollapsed`, so we assert
// behavior through the returned API and those callbacks.

describe("useAddFromNotes", () => {
  let pinSection: ReturnType<typeof vi.fn>;
  let toggleGoalsCollapsed: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pinSection = vi.fn();
    toggleGoalsCollapsed = vi.fn();
  });

  const setup = (isGoalsCollapsed: boolean) =>
    renderHook(
      ({ collapsed }: { collapsed: boolean }) =>
        useAddFromNotes({
          isGoalsCollapsed: collapsed,
          toggleGoalsCollapsed,
          pinSection,
        }),
      { initialProps: { collapsed: isGoalsCollapsed } }
    );

  it("starts with no selection", () => {
    const { result } = setup(false);
    expect(result.current.selection.some).toBe(false);
  });

  it("ignores a whitespace-only selection (no selection, no URL change)", () => {
    const { result } = setup(false);
    act(() => result.current.addFromNote(PanelSection.Actions, "   "));
    expect(result.current.selection.some).toBe(false);
    expect(pinSection).not.toHaveBeenCalled();
  });

  it("emits a trimmed selection carrying the section, and pins it when expanded", () => {
    const { result } = setup(false);
    act(() =>
      result.current.addFromNote(PanelSection.Agreements, "  do the thing  ")
    );

    expect(result.current.selection.some).toBe(true);
    if (result.current.selection.some) {
      expect(result.current.selection.val.section).toBe(PanelSection.Agreements);
      expect(result.current.selection.val.text).toBe("do the thing");
    }
    expect(pinSection).toHaveBeenCalledWith(PanelSection.Agreements);
  });

  it("bumps the nonce on each call", () => {
    const { result } = setup(false);
    act(() => result.current.addFromNote(PanelSection.Actions, "one"));
    const first =
      result.current.selection.some && result.current.selection.val.nonce;
    act(() => result.current.addFromNote(PanelSection.Actions, "two"));
    const second =
      result.current.selection.some && result.current.selection.val.nonce;
    expect(typeof first).toBe("number");
    expect(second).toBe((first as number) + 1);
  });

  it("expands the panel when collapsed and defers the URL pin until expanded", () => {
    const { result, rerender } = setup(true);
    act(() => result.current.addFromNote(PanelSection.Goals, "a goal"));

    // Collapsed: request expansion, but do not pin the section yet (would
    // clobber the layout's focus/transcript params on the same tick).
    expect(toggleGoalsCollapsed).toHaveBeenCalledTimes(1);
    expect(pinSection).not.toHaveBeenCalled();

    // Once expanded, the deferred pin fires exactly once for this nonce.
    rerender({ collapsed: false });
    expect(pinSection).toHaveBeenCalledTimes(1);
    expect(pinSection).toHaveBeenCalledWith(PanelSection.Goals);
  });

  it("pins each section only once per nonce", () => {
    const { result, rerender } = setup(false);
    act(() => result.current.addFromNote(PanelSection.Actions, "x"));
    rerender({ collapsed: false }); // unrelated re-render
    expect(pinSection).toHaveBeenCalledTimes(1);
  });
});
