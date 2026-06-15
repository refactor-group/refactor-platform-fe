import { describe, it, expect } from "vitest";
import { RelationshipRole } from "@/types/relationship-role";
import {
  LockExtent,
  isLockedFor,
  NO_AFTER_SESSION_LOCK,
} from "@/types/after-session-lock";

describe("isLockedFor", () => {
  it("None locks neither role", () => {
    expect(isLockedFor(LockExtent.None, RelationshipRole.Coach)).toBe(false);
    expect(isLockedFor(LockExtent.None, RelationshipRole.Coachee)).toBe(false);
  });

  it("Both locks either role", () => {
    expect(isLockedFor(LockExtent.Both, RelationshipRole.Coach)).toBe(true);
    expect(isLockedFor(LockExtent.Both, RelationshipRole.Coachee)).toBe(true);
  });

  it("Coachee locks only the coachee", () => {
    expect(isLockedFor(RelationshipRole.Coachee, RelationshipRole.Coachee)).toBe(true);
    expect(isLockedFor(RelationshipRole.Coachee, RelationshipRole.Coach)).toBe(false);
  });

  it("Coach locks only the coach", () => {
    expect(isLockedFor(RelationshipRole.Coach, RelationshipRole.Coach)).toBe(true);
    expect(isLockedFor(RelationshipRole.Coach, RelationshipRole.Coachee)).toBe(false);
  });

  it("NO_AFTER_SESSION_LOCK locks nothing for anyone", () => {
    for (const role of [RelationshipRole.Coach, RelationshipRole.Coachee]) {
      expect(isLockedFor(NO_AFTER_SESSION_LOCK.sections, role)).toBe(false);
      expect(isLockedFor(NO_AFTER_SESSION_LOCK.newTopic, role)).toBe(false);
    }
  });
});
