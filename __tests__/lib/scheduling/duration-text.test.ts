import { describe, expect, it } from "vitest";
import { durationText } from "@/lib/scheduling-copy";

describe("durationText", () => {
  it.each([
    [30, "30 min"],
    [50, "50 min"],
    [90, "90 min"],
  ])("%i minutes read %s", (minutes, text) => {
    expect(durationText(minutes)).toBe(text);
  });
});
