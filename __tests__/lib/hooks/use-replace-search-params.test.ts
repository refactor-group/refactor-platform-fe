import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useReplaceSearchParams } from "@/lib/hooks/use-replace-search-params";

const mockReplace = vi.fn();

function setUrl(search: string): void {
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams(search) as never
  );
}

describe("useReplaceSearchParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ replace: mockReplace } as never);
    vi.mocked(usePathname).mockReturnValue("/actions");
    setUrl("");
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("merges updates into the current params", () => {
    setUrl("status=all&view=board");
    const { result } = renderHook(() => useReplaceSearchParams());

    result.current((p) => p.set("range", "week"));

    expect(mockReplace).toHaveBeenCalledWith(
      "/actions?status=all&view=board&range=week",
      { scroll: false }
    );
  });

  it("drops the query string when no params remain", () => {
    setUrl("status=all");
    const { result } = renderHook(() => useReplaceSearchParams());

    result.current((p) => p.delete("status"));

    expect(mockReplace).toHaveBeenCalledWith("/actions", { scroll: false });
  });

  it("keeps basePath out of the URL it passes to the router (#475)", () => {
    window.history.replaceState({}, "", "/pr-428/actions");
    const { result } = renderHook(() => useReplaceSearchParams());

    result.current((p) => p.set("status", "all"));

    expect(mockReplace).toHaveBeenCalledWith("/actions?status=all", {
      scroll: false,
    });
  });
});
