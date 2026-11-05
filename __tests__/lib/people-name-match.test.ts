import { describe, expect, it } from "vitest";
import { matchesPersonName } from "@/lib/people";

describe("matchesPersonName", () => {
  it.each([
    ["Alex Chen", "", true],
    ["Alex Chen", "   ", true],
    ["Alex Chen", "alex", true],
    ["Alex Chen", " CHEN ", true],
    ["Alex Chen", "x c", true],
    ["Alex Chen", "erin", false],
  ])("%s matches %j: %s", (name, query, expected) => {
    expect(matchesPersonName(name, query)).toBe(expected);
  });
});
