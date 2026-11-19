import type { Id } from "@/types/general";
import type { Participant, Participants } from "@/types/participant";
import type { RelationshipRole } from "@/types/relationship-role";
import { type Option, None, Some } from "@/types/option";

/** Anything that carries a relationship's participants, a relationship or a session. */
interface WithParticipants {
  participants: Participants;
}

/** Which seat of a relationship, by coach_id or coachee_id; for seat-ordered copy only. */
export enum Seat {
  Coach = "coach",
  Coachee = "coachee",
}

function find(participants: Participants, id: Id): Option<Participant> {
  const found = participants.find((p) => p.id === id);
  return found ? Some(found) : None;
}

export function participantOf(rel: WithParticipants, userId: Id): Option<Participant> {
  return find(rel.participants, userId);
}

type Seated = WithParticipants & { coach_id: Id; coachee_id: Id };

/** Whoever holds a seat; the fetch boundary guarantees both seats have a participant. */
export function seatParticipant(rel: Seated, seat: Seat): Participant {
  // Both seats share one id in a self-relationship; only there does the [coach, coachee] order decide.
  if (rel.coach_id === rel.coachee_id) return rel.participants[seat === Seat.Coach ? 0 : 1];
  const found = find(rel.participants, seatId(rel, seat));
  if (found.none) throw new Error(`No participant in the ${seat} seat`);
  return found.val;
}

function seatId(rel: Seated, seat: Seat): Id {
  switch (seat) {
    case Seat.Coach:
      return rel.coach_id;
    case Seat.Coachee:
      return rel.coachee_id;
    default: {
      const _exhaustive: never = seat;
      throw new Error(`Unhandled seat: ${_exhaustive}`);
    }
  }
}

/** The person `userId` meets with: the coachee seat when they hold the coach seat (a self-relationship too), else the coach seat. */
export function otherParticipantOf(rel: Seated, userId: Id): Participant {
  return seatParticipant(rel, rel.coach_id === userId ? Seat.Coachee : Seat.Coach);
}

export function roleOf(rel: WithParticipants, userId: Id): Option<RelationshipRole> {
  const participant = participantOf(rel, userId);
  return participant.some ? Some(participant.val.role) : None;
}

/** A participant's role; for a caller that already knows `userId` is in the relationship. */
export function roleIn(rel: WithParticipants, userId: Id): RelationshipRole {
  const role = roleOf(rel, userId);
  if (role.none) throw new Error("Not a participant of the relationship");
  return role.val;
}

export function participantName(p: Participant): string {
  return `${p.first_name} ${p.last_name}`.trim();
}

/** Whether a participant is still a member of the relationship's organization. */
export function isMember(rel: WithParticipants, userId: Id): boolean {
  const participant = participantOf(rel, userId);
  return participant.some && participant.val.is_member;
}

/** The participants no longer in the organization: they keep existing assignments but can't be newly assigned. */
export function nonMemberIds(rel: WithParticipants): Id[] {
  return rel.participants.filter((p) => !p.is_member).map((p) => p.id);
}

/** The session's other person, when it was read with its relationship. */
export function otherParticipantInSession(
  session: { relationship?: { coach_id: Id; coachee_id: Id }; participants: Option<Participants> },
  userId: Id
): Option<Participant> {
  const { relationship, participants } = session;
  if (!relationship || participants.none) return None;
  return Some(otherParticipantOf({ ...relationship, participants: participants.val }, userId));
}
