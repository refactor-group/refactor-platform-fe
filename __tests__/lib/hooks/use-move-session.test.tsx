import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { DateTime } from "ts-luxon";
import { WeekGridStoreProvider, useWeekGridStore } from "@/lib/providers/week-grid-store-provider";
import { useMoveSession } from "@/lib/hooks/use-move-session";
import { createMockEnrichedSession } from "../../test-utils";

const update = vi.fn();
vi.mock("@/lib/api/coaching-sessions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/coaching-sessions")>();
  return { ...actual, CoachingSessionApi: { ...actual.CoachingSessionApi, update: (...a: unknown[]) => update(...a) } };
});

const revalidate = vi.fn();
vi.mock("@/lib/hooks/use-sse-cache-invalidation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/hooks/use-sse-cache-invalidation")>()),
  revalidateEndpointCaches: (...a: unknown[]) => revalidate(...a),
}));

const { toast } = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/lib/toast", () => ({ toast }));

const TZ = "America/Chicago";
const session = createMockEnrichedSession({ id: "s-1", date: "2026-08-18T19:30:00", duration_minutes: 50 });
const TO = DateTime.fromISO("2026-08-20T10:00", { zone: TZ });

const wrapper = ({ children }: { children: ReactNode }) => <WeekGridStoreProvider>{children}</WeekGridStoreProvider>;
function setup() {
  return renderHook(() => ({ move: useMoveSession(), moved: useWeekGridStore((s) => s.recentlyMoved) }), { wrapper });
}
const flush = () => act(async () => {});

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  update.mockResolvedValue({});
});

describe("useMoveSession", () => {
  it("writes the new start in UTC, keeping the rest of the session", async () => {
    const { result } = setup();
    act(() => result.current.move({ session, name: "Ehab Bandar", to: TO }));
    await flush();
    expect(update).toHaveBeenCalledTimes(1);
    const [id, body] = update.mock.calls[0];
    expect(id).toBe("s-1");
    expect(body).toMatchObject({ id: "s-1", date: "2026-08-20T15:00:00", duration_minutes: 50 });
  });

  it("refreshes session reads, marks the card moved, and offers Undo", async () => {
    const { result } = setup();
    act(() => result.current.move({ session, name: "Ehab Bandar", to: TO }));
    await flush();
    expect(revalidate).toHaveBeenCalledWith(expect.anything(), expect.any(String), "/coaching_sessions");
    expect(result.current.moved).toEqual(["s-1"]);
    const [message, options] = toast.mock.calls[0];
    expect(message).toBe("Moved Ehab to Thu, 10:00 AM · this session only");
    expect(options.action.label).toBe("Undo");
  });

  it("Undo writes the previous start back and refreshes again", async () => {
    const { result } = setup();
    act(() => result.current.move({ session, name: "Ehab Bandar", to: TO }));
    await flush();
    act(() => toast.mock.calls[0][1].action.onClick());
    await flush();
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[1][1]).toMatchObject({ date: "2026-08-18T19:30:00" });
    expect(revalidate).toHaveBeenCalledTimes(2);
    expect(result.current.moved).toEqual([]);
  });

  it("says so when the move fails, and marks nothing", async () => {
    update.mockRejectedValue(new Error("boom"));
    const { result } = setup();
    act(() => result.current.move({ session, name: "Ehab Bandar", to: TO }));
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Couldn't move the session · Try again");
    expect(result.current.moved).toEqual([]);
  });
});
