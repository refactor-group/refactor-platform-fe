import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { createMockEnrichedSession } from "../../test-utils";
import { weekEdges, weekOf } from "@/lib/week-grid/week";

const TZ = "America/Chicago";
const week = weekOf(0, DateTime.fromISO("2026-08-19T12:00:00", { zone: TZ }), TZ);
// Week runs Mon Aug 17 00:00 to Sun Aug 23 23:59 Chicago, i.e. 05:00Z boundaries.
const at = (utc: string) => createMockEnrichedSession({ date: utc });

describe("weekEdges", () => {
  it("has nothing earlier when the read comes back empty", () => {
    expect(weekEdges([], week)).toEqual({ hasEarlier: false });
  });

  it("finds an earlier session before Monday's local midnight", () => {
    expect(weekEdges([at("2026-08-17T04:59:00")], week).hasEarlier).toBe(true);
  });

  it("ignores a session from Monday itself when looking back", () => {
    expect(weekEdges([at("2026-08-17T05:00:00")], week).hasEarlier).toBe(false);
  });
});
