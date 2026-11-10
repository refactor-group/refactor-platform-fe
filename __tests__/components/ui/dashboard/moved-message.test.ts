import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { movedMessage } from "@/components/ui/dashboard/session-change-message";

describe("movedMessage", () => {
  it("names the person by first name, the new weekday and time, and the scope", () => {
    const start = DateTime.fromISO("2026-08-20T10:00", { zone: "America/Chicago" });
    expect(movedMessage("Ehab Bandar", start)).toBe("Moved Ehab to Thu, 10:00 AM · this session only");
  });
});
