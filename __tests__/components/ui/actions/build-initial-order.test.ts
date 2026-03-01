import { describe, it, expect } from "vitest";
import { buildInitialOrder } from "@/components/ui/actions/utils";

describe("buildInitialOrder", () => {
  it("returns null when IDs have not changed", () => {
    const previous = new Map([
      ["a", 0],
      ["b", 1],
    ]);
    expect(buildInitialOrder(previous, ["a", "b"])).toBeNull();
  });

  it("returns null for empty previous and empty current", () => {
    expect(buildInitialOrder(new Map(), [])).toBeNull();
  });

  it("returns a new map when IDs are added", () => {
    const previous = new Map([["a", 0]]);
    const result = buildInitialOrder(previous, ["a", "b"]);
    expect(result).not.toBeNull();
    expect(result!.get("a")).toBe(0);
    expect(result!.get("b")).toBe(1);
  });

  it("returns a new map when IDs are removed", () => {
    const previous = new Map([
      ["a", 0],
      ["b", 1],
    ]);
    const result = buildInitialOrder(previous, ["a"]);
    expect(result).not.toBeNull();
    expect(result!.get("a")).toBe(0);
    expect(result!.has("b")).toBe(false);
  });

  it("preserves order for existing IDs when new ones are appended", () => {
    const previous = new Map([
      ["x", 0],
      ["y", 1],
    ]);
    const result = buildInitialOrder(previous, ["x", "y", "z"]);
    expect(result).not.toBeNull();
    expect(result!.get("x")).toBe(0);
    expect(result!.get("y")).toBe(1);
    expect(result!.get("z")).toBe(2);
  });

  it("builds a fresh map from empty previous with new IDs", () => {
    const result = buildInitialOrder(new Map(), ["a", "b", "c"]);
    expect(result).not.toBeNull();
    expect(result!.get("a")).toBe(0);
    expect(result!.get("b")).toBe(1);
    expect(result!.get("c")).toBe(2);
  });
});
