import { describe, expect, it } from "vitest";
import {
  DURATION_CHIPS,
  DURATION_FIELD_MAX,
  DURATION_FIELD_MIN,
  DURATION_FIELD_STEP,
  clampDuration,
  matchingChip,
  stepDuration,
} from "@/types/coaching-session-duration";
import { None, Some } from "@/types/option";

describe("duration field rules", () => {
  it("offers the four chips and the stepper bounds", () => {
    expect(DURATION_CHIPS).toEqual([30, 45, 50, 60]);
    expect([DURATION_FIELD_MIN, DURATION_FIELD_MAX, DURATION_FIELD_STEP]).toEqual([15, 180, 5]);
  });

  it("rounds to the nearest 5 and clamps to 15–180", () => {
    expect(clampDuration(52)).toBe(50);
    expect(clampDuration(53)).toBe(55);
    expect(clampDuration(7)).toBe(15);
    expect(clampDuration(400)).toBe(180);
    expect(clampDuration(15)).toBe(15);
    expect(clampDuration(180)).toBe(180);
  });

  it("treats a non-number as the minimum", () => {
    expect(clampDuration(Number.NaN)).toBe(15);
  });

  it("steps by 5 inside the bounds", () => {
    expect(stepDuration(50, 1)).toBe(55);
    expect(stepDuration(50, -1)).toBe(45);
    expect(stepDuration(180, 1)).toBe(180);
    expect(stepDuration(15, -1)).toBe(15);
    expect(stepDuration(52, 1)).toBe(55);
  });

  it("selects a chip only on an exact match", () => {
    expect(matchingChip(50)).toEqual(Some(50));
    expect(matchingChip(55)).toEqual(None);
  });
});
