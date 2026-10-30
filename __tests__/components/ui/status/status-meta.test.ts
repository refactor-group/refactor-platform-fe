import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import { type Option, Some, None } from "@/types/option";
import {
  statusMeta,
  formatStatusMeta,
  type StatusMeta,
} from "@/components/ui/status/status-meta";

const zone = "America/Chicago";
const at = (iso: string) => DateTime.fromISO(iso, { zone });
const now = at("2026-10-30T12:00:00");
const changed = at("2026-10-01T09:00:00");

const metaFor = (status: ItemStatus, dueBy: Option<DateTime> = None) =>
  statusMeta({ status, dueBy, statusChangedAt: changed }, now);

describe("statusMeta", () => {
  it("marks an open item due yesterday as overdue", () => {
    expect(metaFor(ItemStatus.NotStarted, Some(at("2026-10-29"))).kind).toBe("overdue");
  });

  it("treats due today as due, not overdue", () => {
    expect(metaFor(ItemStatus.NotStarted, Some(at("2026-10-30T23:00:00"))).kind).toBe("due");
  });

  it("treats a future due date as due", () => {
    expect(metaFor(ItemStatus.NotStarted, Some(at("2026-11-04"))).kind).toBe("due");
  });

  it("returns none for an open item without a due date", () => {
    expect(metaFor(ItemStatus.InProgress)).toEqual({ kind: "none" });
  });

  it("returns paused, never overdue, for an on-hold item past due", () => {
    const meta = metaFor(ItemStatus.OnHold, Some(at("2026-10-20")));
    expect(meta.kind).toBe("paused");
    if (meta.kind !== "paused") throw new Error("expected paused");
    expect(meta.dueBy.some).toBe(true);
  });

  it("returns done at statusChangedAt for a completed item", () => {
    const doneAt = at("2026-08-15");
    expect(
      statusMeta({ status: ItemStatus.Completed, dueBy: None, statusChangedAt: doneAt }, now)
    ).toEqual({ kind: "done", at: doneAt });
  });

  it("returns closed at statusChangedAt for a won't-do item", () => {
    const closedAt = at("2026-08-13");
    expect(
      statusMeta({ status: ItemStatus.WontDo, dueBy: None, statusChangedAt: closedAt }, now)
    ).toEqual({ kind: "closed", at: closedAt });
  });
});

describe("formatStatusMeta", () => {
  const cases: Array<[string, StatusMeta, string]> = [
    ["due", { kind: "due", dueBy: at("2026-11-04") }, "Due Nov 4"],
    ["overdue", { kind: "overdue", dueBy: at("2026-10-29") }, "Due Oct 29"],
    ["paused with due", { kind: "paused", dueBy: Some(at("2026-10-20")) }, "Paused · was due Oct 20"],
    ["paused without due", { kind: "paused", dueBy: None }, "Paused"],
    ["done", { kind: "done", at: at("2026-08-15") }, "Done Aug 15"],
    ["closed", { kind: "closed", at: at("2026-08-13") }, "Closed Aug 13"],
  ];

  it.each(cases)("formats %s", (_label, meta, expected) => {
    expect(formatStatusMeta(meta)).toEqual(Some(expected));
  });

  it("returns None for none", () => {
    expect(formatStatusMeta({ kind: "none" }).none).toBe(true);
  });
});
