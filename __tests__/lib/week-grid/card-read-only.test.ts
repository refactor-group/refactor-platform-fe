import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { createMockEnrichedSession } from "../../test-utils";
import { cardView, readOnlyView } from "@/lib/week-grid/card";

const NOW = DateTime.fromISO("2026-08-18T18:45:00Z", { zone: "utc" });
const CONTEXT = { viewerId: "coach-1", now: NOW, timezone: "America/Chicago" };

describe("readOnlyView", () => {
  it("takes away managing", () => {
    const view = cardView(createMockEnrichedSession({ date: "2026-08-20T15:00:00", duration_minutes: 50 }), CONTEXT);
    expect(view.canManage).toBe(true);
    expect(readOnlyView(view).canManage).toBe(false);
  });

  it("leaves everything else alone", () => {
    const view = cardView(createMockEnrichedSession({ date: "2026-08-20T15:00:00", duration_minutes: 50 }), CONTEXT);
    expect({ ...readOnlyView(view), canManage: view.canManage }).toEqual(view);
  });
});
