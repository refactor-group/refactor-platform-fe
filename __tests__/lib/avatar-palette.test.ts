import { describe, expect, it } from "vitest";
import { AVATAR_TONE_CLASSES, avatarToneFor } from "@/lib/avatar-palette";

describe("avatarToneFor", () => {
  it("returns the same tone for the same id", () => {
    for (const id of ["a", "user-1", "user-2", "abc-123", "zz"]) {
      expect(avatarToneFor(id)).toBe(avatarToneFor(id));
    }
  });

  it("returns integer tones in 1..8", () => {
    for (let i = 0; i < 100; i++) {
      const tone = avatarToneFor(`id-${i}`);
      expect(Number.isInteger(tone)).toBe(true);
      expect(tone).toBeGreaterThanOrEqual(1);
      expect(tone).toBeLessThanOrEqual(8);
    }
  });

  it("spreads ids across at least 6 tones", () => {
    const tones = new Set(
      Array.from({ length: 100 }, (_, i) => avatarToneFor(`user-${i}`))
    );
    expect(tones.size).toBeGreaterThanOrEqual(6);
  });

  it("matches known regression values", () => {
    expect(avatarToneFor("a")).toBe(5);
    expect(avatarToneFor("user-1")).toBe(5);
    expect(avatarToneFor("3f2b6c1e-0000-4000-8000-000000000000")).toBe(2);
  });
});

describe("AVATAR_TONE_CLASSES", () => {
  it("has one class string per tone", () => {
    const entries = Object.entries(AVATAR_TONE_CLASSES);
    expect(entries).toHaveLength(8);
    for (const [tone, classes] of entries) {
      expect(classes).toContain(`bg-avatar-${tone}`);
      expect(classes).toContain(`text-avatar-${tone}-foreground`);
    }
  });
});
