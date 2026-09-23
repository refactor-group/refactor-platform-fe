import { describe, it, expect } from "vitest";
import { edgeScrollDelta } from "@/components/ui/coaching-sessions/coaching-notes/use-note-image-move";

// A 400px visible area: the edge zone is 48px deep at each end.
const TOP = 100;
const BOTTOM = 500;

describe("edgeScrollDelta", () => {
  it("does nothing away from the edges", () => {
    expect(edgeScrollDelta(300, TOP, BOTTOM)).toBe(0);
    expect(edgeScrollDelta(TOP + 48, TOP, BOTTOM)).toBe(0);
    expect(edgeScrollDelta(BOTTOM - 48, TOP, BOTTOM)).toBe(0);
  });

  it("scrolls down near the bottom edge and up near the top", () => {
    expect(edgeScrollDelta(BOTTOM - 10, TOP, BOTTOM)).toBeGreaterThan(0);
    expect(edgeScrollDelta(TOP + 10, TOP, BOTTOM)).toBeLessThan(0);
  });

  it("speeds up the deeper the pointer goes into the zone", () => {
    const shallow = edgeScrollDelta(BOTTOM - 40, TOP, BOTTOM);
    const deep = edgeScrollDelta(BOTTOM - 5, TOP, BOTTOM);
    expect(deep).toBeGreaterThan(shallow);
  });

  // A pointer held past the edge, outside the note entirely, is still asking to go on.
  it("runs flat out past the edge rather than stopping", () => {
    const atEdge = edgeScrollDelta(BOTTOM, TOP, BOTTOM);
    expect(edgeScrollDelta(BOTTOM + 200, TOP, BOTTOM)).toBe(atEdge);
    expect(edgeScrollDelta(TOP - 200, TOP, BOTTOM)).toBe(-atEdge);
  });
});
