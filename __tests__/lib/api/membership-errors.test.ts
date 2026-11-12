import { describe, it, expect } from "vitest";
import { AddBackPurpose, notAMemberMessage } from "@/lib/api/membership-errors";
import { None, Some } from "@/types/option";

describe("notAMemberMessage", () => {
  it("offers an admin the next step for each write", () => {
    expect(notAMemberMessage(AddBackPurpose.ScheduleSessions, Some("Maya Diaz"), true)).toBe(
      "Maya Diaz is no longer in this organization · Add Maya Diaz back to schedule sessions"
    );
    expect(notAMemberMessage(AddBackPurpose.ResendInvite, Some("Maya Diaz"), true)).toBe(
      "Maya Diaz is no longer in this organization · Add Maya Diaz back to resend the invite"
    );
    expect(notAMemberMessage(AddBackPurpose.AssignActions, Some("Maya Diaz"), true)).toBe(
      "Maya Diaz is no longer in this organization · Add Maya Diaz back to assign actions"
    );
  });

  it("points anyone else at an admin", () => {
    expect(notAMemberMessage(AddBackPurpose.ScheduleSessions, Some("Maya Diaz"), false)).toBe(
      "Maya Diaz is no longer in this organization · Ask an admin to add Maya Diaz back"
    );
  });

  it("still reads naturally without a name", () => {
    expect(notAMemberMessage(AddBackPurpose.ResendInvite, None, false)).toBe(
      "This person is no longer in this organization · Ask an admin to add this person back"
    );
  });
});
