import { describe, expect, it } from "vitest";
import { stepDuration } from "@/types/coaching-session-duration";

describe("stepDuration from a length outside 15–180", () => {
  it("steps down from a longer session to the maximum", () => {
    expect(stepDuration(240, -1)).toBe(180);
    expect(stepDuration(183, -1)).toBe(180);
  });

  it("steps up from a shorter session to the minimum", () => {
    expect(stepDuration(10, 1)).toBe(15);
    expect(stepDuration(1, 1)).toBe(15);
  });
});
