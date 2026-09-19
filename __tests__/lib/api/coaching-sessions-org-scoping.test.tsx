import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReactNode } from "react";
import { DateTime } from "ts-luxon";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import {
  useEnrichedCoachingSessionsForUser,
  useEnrichedCoachingSessionsForUserCounts,
} from "@/lib/api/coaching-sessions";
import { EntityApi } from "@/lib/api/entity-api";

// Real SWR, stubbed HTTP boundary: asserts the outgoing request and lets an
// organization switch exercise the real cache key.
function SwrWrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

const FROM = DateTime.fromISO("2026-07-01");
const TO = DateTime.fromISO("2026-07-31");
const USER_ID = "user-1";

describe("user coaching sessions are scoped by organization", () => {
  let listNestedFn: ReturnType<typeof vi.spyOn>;
  let getFn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    listNestedFn = vi
      .spyOn(EntityApi, "listNestedFn")
      .mockResolvedValue([] as never);
    getFn = vi
      .spyOn(EntityApi, "getFn")
      .mockResolvedValue({ counts: [] } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends organization_id on the session list request", async () => {
    renderHook(
      () =>
        useEnrichedCoachingSessionsForUser(
          USER_ID,
          FROM,
          TO,
          [],
          undefined,
          undefined,
          undefined,
          "America/Los_Angeles",
          "org-1"
        ),
      { wrapper: SwrWrapper }
    );

    await waitFor(() => expect(listNestedFn).toHaveBeenCalled());
    const [, , , options] = listNestedFn.mock.calls[0];
    expect(options.params.organization_id).toBe("org-1");
  });

  it("omits organization_id when there is no current organization", async () => {
    renderHook(
      () =>
        useEnrichedCoachingSessionsForUser(
          USER_ID,
          FROM,
          TO,
          [],
          undefined,
          undefined,
          undefined,
          "America/Los_Angeles"
        ),
      { wrapper: SwrWrapper }
    );

    await waitFor(() => expect(listNestedFn).toHaveBeenCalled());
    const [, , , options] = listNestedFn.mock.calls[0];
    expect(options.params).not.toHaveProperty("organization_id");
  });

  // Pins organization_id into the SWR key. Without it the switch would serve
  // the previous organization's cached list, reproducing the original bug.
  it("issues a new request when the current organization changes", async () => {
    const { rerender } = renderHook(
      ({ organizationId }: { organizationId: string }) =>
        useEnrichedCoachingSessionsForUser(
          USER_ID,
          FROM,
          TO,
          [],
          undefined,
          undefined,
          undefined,
          "America/Los_Angeles",
          organizationId
        ),
      { wrapper: SwrWrapper, initialProps: { organizationId: "org-1" } }
    );

    await waitFor(() => expect(listNestedFn).toHaveBeenCalledTimes(1));

    rerender({ organizationId: "org-2" });

    await waitFor(() => expect(listNestedFn).toHaveBeenCalledTimes(2));
    const [, , , options] = listNestedFn.mock.calls[1];
    expect(options.params.organization_id).toBe("org-2");
  });

  it("sends organization_id on the counts request", async () => {
    renderHook(
      () =>
        useEnrichedCoachingSessionsForUserCounts(
          USER_ID,
          FROM,
          TO,
          "America/Los_Angeles",
          undefined,
          "org-1"
        ),
      { wrapper: SwrWrapper }
    );

    await waitFor(() => expect(getFn).toHaveBeenCalled());
    const [, options] = getFn.mock.calls[0];
    expect(options.params.organization_id).toBe("org-1");
  });
});
