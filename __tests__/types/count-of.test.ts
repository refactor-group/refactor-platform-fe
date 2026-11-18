import { describe, expect, it } from "vitest";
import { countOf } from "@/types/general";

describe("countOf", () => {
  it.each([
    [0, "0 actions"],
    [1, "1 action"],
    [2, "2 actions"],
  ])("counts %i", (count, text) => {
    expect(countOf(count, "action")).toBe(text);
  });
});
