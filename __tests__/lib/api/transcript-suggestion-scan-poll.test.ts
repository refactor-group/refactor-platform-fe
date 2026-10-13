// A running scan is re-read on a timer, in case its finishing event never arrives.

import { describe, it, expect } from "vitest";
import { SCAN_POLL_MS, scanPollInterval } from "@/lib/api/transcript-suggestions";
import { ScanStatus } from "@/types/transcript-suggestion";

describe("scanPollInterval", () => {
  it("polls only while a scan is queued or running", () => {
    expect(scanPollInterval(ScanStatus.Pending)).toBe(SCAN_POLL_MS);
    expect(scanPollInterval(ScanStatus.Processing)).toBe(SCAN_POLL_MS);
    for (const settled of [
      ScanStatus.Unavailable,
      ScanStatus.None,
      ScanStatus.Completed,
      ScanStatus.Failed,
    ]) {
      expect(scanPollInterval(settled)).toBe(0);
    }
  });
});
