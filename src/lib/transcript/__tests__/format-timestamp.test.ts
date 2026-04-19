import { describe, it, expect } from "vitest";

import { formatTimestamp } from "../format-timestamp";

describe("formatTimestamp", () => {
  it("formats zero as 0:00", () => {
    expect(formatTimestamp(0)).toBe("0:00");
  });

  it("formats sub-minute durations with zero-padded seconds", () => {
    expect(formatTimestamp(7_000)).toBe("0:07");
    expect(formatTimestamp(59_999)).toBe("0:59");
  });

  it("formats minutes without zero-padding the minute", () => {
    expect(formatTimestamp(62_000)).toBe("1:02");
    expect(formatTimestamp(754_000)).toBe("12:34");
  });

  it("switches to h:mm:ss at the one-hour mark", () => {
    expect(formatTimestamp(3_600_000)).toBe("1:00:00");
    expect(formatTimestamp(3_723_000)).toBe("1:02:03");
  });

  it("pads minutes when in the h:mm:ss format", () => {
    expect(formatTimestamp(3_605_000)).toBe("1:00:05");
  });

  it("clamps negative values to zero", () => {
    expect(formatTimestamp(-1)).toBe("0:00");
    expect(formatTimestamp(-10_000)).toBe("0:00");
  });

  it("clamps non-finite values to zero", () => {
    expect(formatTimestamp(NaN)).toBe("0:00");
    expect(formatTimestamp(Infinity)).toBe("0:00");
    expect(formatTimestamp(-Infinity)).toBe("0:00");
  });

  it("truncates sub-second fractions rather than rounding", () => {
    // 1999ms → 1 whole second
    expect(formatTimestamp(1_999)).toBe("0:01");
  });
});
