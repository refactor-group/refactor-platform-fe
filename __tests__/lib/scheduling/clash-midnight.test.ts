import { describe, expect, it } from "vitest";
import { clashFor } from "@/lib/schedule-draft";

import { at, busy } from "./fixtures";

const NINE_TO_FIVE = { start: 9 * 60, end: 17 * 60 };

describe("clashFor across midnight", () => {
  it("doesn't offer a time still inside a session from the night before", () => {
    const late = busy("s-late", "Alex Chen", "2026-08-17T23:00", "2026-08-18T01:00");
    const clash = clashFor({ start: at("2026-08-18T00:00"), minutes: 30 }, [late], NINE_TO_FIVE);
    expect(clash.some && clash.val.session.id).toBe("s-late");
    const instead = clash.some && clash.val.instead.some ? clash.val.instead.val.toFormat("HH:mm") : "none";
    expect(instead).toBe("01:00");
  });
});
