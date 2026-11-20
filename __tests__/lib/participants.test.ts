import { describe, expect, it } from "vitest";
import {
  Seat,
  isMember,
  nonMemberIds,
  otherParticipantInSession,
  otherParticipantOf,
  participantOf,
  roleIn,
  roleOf,
  seatParticipant,
} from "@/lib/participants";
import { RelationshipKind } from "@/types/coaching-relationship";
import { None, Some } from "@/types/option";
import { RelationshipRole } from "@/types/relationship-role";
import { createMockEnrichedSession, createMockRelationship } from "../test-utils";

const rel = createMockRelationship({ coach_id: "c", coachee_id: "e" }, { coachee: { is_member: false } });
const colleagues = createMockRelationship({ coach_id: "a", coachee_id: "b", kind: RelationshipKind.Colleague });
// Backend sends [coach seat, coachee seat]; both share the one id.
const self = createMockRelationship(
  { coach_id: "me", coachee_id: "me" },
  { coach: { first_name: "Coach" }, coachee: { first_name: "Coachee" } }
);

describe("participantOf", () => {
  it("finds a participant by id", () => {
    const found = participantOf(rel, "e");
    expect(found.some && found.val.id).toBe("e");
  });

  it("is None for someone outside the relationship", () => {
    expect(participantOf(rel, "x")).toEqual(None);
  });
});

describe("seatParticipant", () => {
  it("finds each seat by its id, not its index", () => {
    const reversed = { ...rel, participants: [rel.participants[1], rel.participants[0]] as typeof rel.participants };
    expect(seatParticipant(reversed, Seat.Coach).id).toBe("c");
    expect(seatParticipant(reversed, Seat.Coachee).id).toBe("e");
  });

  it("uses the [coach, coachee] order in a self-relationship", () => {
    expect(seatParticipant(self, Seat.Coach).first_name).toBe("Coach");
    expect(seatParticipant(self, Seat.Coachee).first_name).toBe("Coachee");
  });
});

describe("otherParticipantOf", () => {
  it("is the other seat's holder", () => {
    expect(otherParticipantOf(rel, "c").id).toBe("e");
    expect(otherParticipantOf(rel, "e").id).toBe("c");
  });

  it("is the coachee seat in a self-relationship", () => {
    expect(otherParticipantOf(self, "me").first_name).toBe("Coachee");
  });
});

describe("roleOf / roleIn", () => {
  it("reads the role the backend computed", () => {
    expect(roleOf(rel, "c")).toEqual(Some(RelationshipRole.Coach));
    expect(roleIn(rel, "e")).toBe(RelationshipRole.Coachee);
    expect(roleIn(colleagues, "a")).toBe(RelationshipRole.Colleague);
    expect(roleIn(colleagues, "b")).toBe(RelationshipRole.Colleague);
  });

  it("has no role for a non-participant", () => {
    expect(roleOf(rel, "x")).toEqual(None);
    expect(() => roleIn(rel, "x")).toThrow();
  });
});

describe("isMember / nonMemberIds", () => {
  it("reads each participant's membership", () => {
    expect(isMember(rel, "c")).toBe(true);
    expect(isMember(rel, "e")).toBe(false);
    expect(isMember(rel, "someone-else")).toBe(false);
  });

  it("lists the participants who are no longer members", () => {
    expect(nonMemberIds(rel)).toEqual(["e"]);
    expect(nonMemberIds(createMockRelationship())).toEqual([]);
  });
});

describe("otherParticipantInSession", () => {
  it("is the other person in a session read with its relationship", () => {
    const other = otherParticipantInSession(createMockEnrichedSession(), "coach-1");
    expect(other.some && other.val.id).toBe("coachee-1");
  });

  it("is None without a relationship", () => {
    expect(otherParticipantInSession(createMockEnrichedSession({ relationship: undefined }), "coach-1")).toEqual(None);
  });

  it("is None without participants", () => {
    expect(otherParticipantInSession(createMockEnrichedSession({ participants: None }), "coach-1")).toEqual(None);
  });
});
