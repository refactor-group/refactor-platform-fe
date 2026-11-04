import { describe, expect, it } from "vitest";
import { busyWindow } from "@/lib/schedule-draft";
import { None, Some } from "@/types/option";
import { at } from "./roster";

const dates = (window: ReturnType<typeof busyWindow>) => [window.from.toISODate(), window.to.toISODate()];

describe("busyWindow", () => {
  const august = at("2026-08-01T00:00");

  it("covers the shown month's whole weeks", () => {
    expect(dates(busyWindow(august, None))).toEqual(["2026-07-27", "2026-09-06"]);
  });

  it("stretches to the selected day's week in another month", () => {
    expect(dates(busyWindow(august, Some(at("2026-09-17T00:00"))))).toEqual(["2026-07-27", "2026-09-20"]);
    expect(dates(busyWindow(august, Some(at("2026-07-08T00:00"))))).toEqual(["2026-07-06", "2026-09-06"]);
  });

  it("stays put for a selected day inside it", () => {
    expect(dates(busyWindow(august, Some(at("2026-08-18T00:00"))))).toEqual(["2026-07-27", "2026-09-06"]);
  });
});
