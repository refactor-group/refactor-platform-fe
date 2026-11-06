import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkingHours } from "@/lib/hooks/use-working-hours";
import { createMockUser } from "../../test-utils";

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (select: (s: { userId: string }) => unknown) => select({ userId: "user-1" }),
}));

let state: { user: ReturnType<typeof createMockUser> | undefined; isLoading: boolean } = { user: undefined, isLoading: true };
const requested: unknown[] = [];
vi.mock("@/lib/api/users", () => ({
  useUser: (id: unknown) => {
    requested.push(id);
    return state;
  },
}));

beforeEach(() => {
  requested.length = 0;
});

describe("useWorkingHours", () => {
  it("reads the signed-in user's hours", () => {
    state = { user: createMockUser({ working_hours_start: "09:00", working_hours_end: "18:00" }), isLoading: false };
    const { result } = renderHook(() => useWorkingHours());
    expect(requested[0]).toBe("user-1");
    expect(result.current).toEqual({ start: 540, end: 1080 });
  });

  it("uses 8:00 to 5:30 while the user loads", () => {
    state = { user: undefined, isLoading: true };
    const { result } = renderHook(() => useWorkingHours());
    expect(result.current).toEqual({ start: 480, end: 1050 });
  });
});
