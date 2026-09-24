import { describe, it, expect } from "vitest";

import { parseCoachingSessionImage } from "@/types/coaching-session-image";

const validPayload = {
  id: "img-1",
  coaching_session_id: "cs-1",
  mime_type: "image/png",
  byte_size: 1234,
  width: 800,
  height: 600,
  created_at: "2026-09-22T10:00:00Z",
};

describe("parseCoachingSessionImage", () => {
  it("parses a full payload", () => {
    const image = parseCoachingSessionImage(validPayload);

    expect(image.id).toBe("img-1");
    expect(image.coaching_session_id).toBe("cs-1");
    expect(image.mime_type).toBe("image/png");
    expect(image.byte_size).toBe(1234);
    expect(image.width).toEqual({ some: true, none: false, val: 800 });
    expect(image.height).toEqual({ some: true, none: false, val: 600 });
    expect(image.created_at.toUTC().toISO()).toBe("2026-09-22T10:00:00.000Z");
  });

  it("drops wire-only fields", () => {
    const image = parseCoachingSessionImage({
      ...validPayload,
      storage_key: "coaching-sessions/cs-1/notes/img-1.png",
    });

    expect(image).not.toHaveProperty("storage_key");
  });

  it("maps absent dimensions to None", () => {
    const image = parseCoachingSessionImage({
      ...validPayload,
      width: null,
      height: null,
    });

    expect(image.width.none).toBe(true);
    expect(image.height.none).toBe(true);
  });

  it("throws on a payload missing id", () => {
    const { id: _id, ...withoutId } = validPayload;

    expect(() => parseCoachingSessionImage(withoutId)).toThrow();
  });

  it("throws on a payload missing byte_size", () => {
    const { byte_size: _size, ...withoutSize } = validPayload;

    expect(() => parseCoachingSessionImage(withoutSize)).toThrow();
  });

  it("throws on a payload missing coaching_session_id", () => {
    const { coaching_session_id: _sessionId, ...withoutSession } = validPayload;

    expect(() => parseCoachingSessionImage(withoutSession)).toThrow();
  });

  it("throws on a payload missing mime_type", () => {
    const { mime_type: _mime, ...withoutMime } = validPayload;

    expect(() => parseCoachingSessionImage(withoutMime)).toThrow();
  });
});
