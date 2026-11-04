import { describe, expect, it } from "vitest";
import { nextUnstartedSession } from "@/lib/move-draft";
import { None, Some } from "@/types/option";
import { E_04, E_11, E_18, at } from "./roster";

describe("nextUnstartedSession", () => {
  it("picks the earliest session that hasn't started", () => {
    expect(nextUnstartedSession([E_18, E_04, E_11], at("2026-08-05T10:00"))).toEqual(Some(E_11));
  });

  it("counts a session starting right now", () => {
    expect(nextUnstartedSession([E_04, E_11], at("2026-08-11T14:30"))).toEqual(Some(E_11));
  });

  it("is None when every session has started", () => {
    expect(nextUnstartedSession([E_04, E_11], at("2026-08-12T10:00"))).toEqual(None);
  });
});
