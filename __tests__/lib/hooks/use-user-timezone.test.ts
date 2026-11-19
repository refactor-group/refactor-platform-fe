import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ userSession: { id: "", timezone: "UTC" } }));
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (s: typeof state) => unknown) => selector(state),
}));
vi.mock("@/lib/timezone-utils", () => ({ getBrowserTimezone: () => "America/Chicago" }));

const { useUserTimezone } = await vi.importActual<typeof import("@/lib/hooks/use-user-timezone")>(
  "@/lib/hooks/use-user-timezone"
);

describe("useUserTimezone", () => {
  beforeEach(() => {
    state.userSession = { id: "", timezone: "UTC" };
  });

  it("uses the browser's zone before anyone signs in", () => {
    expect(renderHook(() => useUserTimezone()).result.current).toBe("America/Chicago");
  });

  it("uses the profile's zone once signed in, even UTC", () => {
    state.userSession = { id: "me", timezone: "Asia/Tokyo" };
    expect(renderHook(() => useUserTimezone()).result.current).toBe("Asia/Tokyo");
    state.userSession = { id: "me", timezone: "UTC" };
    expect(renderHook(() => useUserTimezone()).result.current).toBe("UTC");
  });
});
