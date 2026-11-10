import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { None, Some } from "@/types/option";

type Listener = (event: { matches: boolean }) => void;

function stubMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => mql));
  return {
    set(matches: boolean) {
      mql.matches = matches;
      listeners.forEach((l) => l({ matches }));
    },
    listeners,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("useMediaQuery", () => {
  it("reports whether the query matches", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(min-width: 900px)"));
    expect(result.current).toEqual(Some(true));
    expect(window.matchMedia).toHaveBeenCalledWith("(min-width: 900px)");
  });

  it("follows changes", () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(min-width: 900px)"));
    expect(result.current).toEqual(Some(false));
    act(() => media.set(true));
    expect(result.current).toEqual(Some(true));
  });

  it("stops listening on unmount", () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery("(min-width: 900px)"));
    expect(media.listeners.size).toBe(1);
    unmount();
    expect(media.listeners.size).toBe(0);
  });
});

describe("useMediaQuery before the browser answers", () => {
  it("is None while rendering on the server", () => {
    function Probe() {
      const matches = useMediaQuery("(min-width: 900px)");
      return <output>{JSON.stringify(matches)}</output>;
    }
    expect(renderToString(<Probe />)).toContain(JSON.stringify(None).replace(/"/g, "&quot;"));
  });
});
