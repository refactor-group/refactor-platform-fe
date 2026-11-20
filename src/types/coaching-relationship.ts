import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";
import { isParticipants, type Participant, type Participants } from "@/types/participant";
import { type Option, None, Some } from "@/types/option";
import { RelationshipRole } from "@/types/relationship-role";
import { otherParticipantOf, participantName, roleOf } from "@/lib/participants";

export enum RelationshipKind {
  Coaching = "coaching",
  Colleague = "colleague",
}

export interface CoachingRelationship {
  id: Id;
  coach_id: Id;
  coachee_id: Id;
  organization_id: Id;
  /** Read-only: the backend ignores it on create and update. */
  kind: RelationshipKind;
  created_at: DateTime;
  updated_at: DateTime;
  /** What the signed-in user may do here, computed by the backend. Null for a non-participant. */
  viewer: RelationshipViewer | null;
  /** Its sessions get suggested actions. */
  suggests_actions: boolean;
  /** The participant whose leaving the organization blocks scheduling, or null. */
  scheduling_blocked_by: Id | null;
}

/**
 * The caller's role and permissions in one relationship, from the same backend checks that
 * enforce them. Display only: never derive these from coach_id or coachee_id.
 */
export interface RelationshipViewer {
  role: RelationshipRole;
  /** Schedule, reschedule, cancel, run series, resend invites, delete anyone's topic. */
  can_schedule_sessions: boolean;
  /** Every action in the relationship, and full suggestion review. */
  sees_all_actions: boolean;
}

/** Until the backend's viewer loads: the most restricted participant. */
export const RESTRICTED_VIEWER: RelationshipViewer = {
  role: RelationshipRole.Coachee,
  can_schedule_sessions: false,
  sees_all_actions: false,
};

export function viewerOf(relationship: CoachingRelationship): Option<RelationshipViewer> {
  return relationship.viewer ? Some(relationship.viewer) : None;
}

export function canScheduleSessionsIn(relationship: CoachingRelationship): boolean {
  const viewer = viewerOf(relationship);
  return viewer.some && viewer.val.can_schedule_sessions;
}

export function schedulingBlockedBy(relationship: CoachingRelationship): Option<Id> {
  return relationship.scheduling_blocked_by ? Some(relationship.scheduling_blocked_by) : None;
}

/** Offer schedule, reschedule and resend. Cancel and delete only need canScheduleSessionsIn. */
export function canScheduleNowIn(relationship: CoachingRelationship): boolean {
  return canScheduleSessionsIn(relationship) && schedulingBlockedBy(relationship).none;
}

/** Coaches someone in at least one of the relationships. Colleagues don't count. */
export function coachesAnyone(relationships: readonly CoachingRelationship[]): boolean {
  return relationships.some((r) => {
    const viewer = viewerOf(r);
    return viewer.some && viewer.val.role === RelationshipRole.Coach;
  });
}

/** Runs sessions in at least one: a coach or a colleague there, not only ever coached. */
export function runsSessionsInAny(relationships: readonly CoachingRelationship[]): boolean {
  return relationships.some((r) => {
    const viewer = viewerOf(r);
    return viewer.some && viewer.val.role !== RelationshipRole.Coachee;
  });
}

/** May schedule in at least one of the relationships: shows the scheduling entry points. */
export function canScheduleInAny(relationships: readonly CoachingRelationship[]): boolean {
  return relationships.some(canScheduleSessionsIn);
}

export function seesAllActionsIn(relationship: CoachingRelationship): boolean {
  const viewer = viewerOf(relationship);
  return viewer.some && viewer.val.sees_all_actions;
}

// This must always reflect the Rust struct on the backend
// entity_api::coaching_relationship::CoachingRelationshipWithUserNames
export type CoachingRelationshipWithUserNames = CoachingRelationship & {
  participants: Participants;
};

export interface NewCoachingRelationship {
  /** For a colleague relationship, either person; the pair is unordered. */
  coach_id: Id;
  coachee_id: Id;
  kind: RelationshipKind;
}

/** Body of a kind switch: coaching names its coach; colleagues have none. */
export type RelationshipKindChange =
  | { kind: RelationshipKind.Coaching; coach_id: Id; confirmed: boolean }
  | { kind: RelationshipKind.Colleague; confirmed: boolean };

/** Whether two people already share a relationship of any kind, either way round. */
export function isPairOf(relationship: CoachingRelationshipWithUserNames, a: Id, b: Id): boolean {
  return (
    (relationship.coach_id === a && relationship.coachee_id === b) ||
    (relationship.coach_id === b && relationship.coachee_id === a)
  );
}

/**
 * Checks a relationship read at the fetch boundary, so a response in another shape fails the
 * fetch instead of a render.
 */
export function parseCoachingRelationship(value: unknown): CoachingRelationshipWithUserNames {
  const object = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  if (
    typeof object.id !== "string" ||
    typeof object.coach_id !== "string" ||
    typeof object.coachee_id !== "string" ||
    !isParticipants(object.participants) ||
    !object.participants.some((p) => p.id === object.coach_id) ||
    !object.participants.some((p) => p.id === object.coachee_id)
  ) {
    throw new Error("Unexpected coaching relationship shape");
  }
  return value as CoachingRelationshipWithUserNames;
}

/** Placeholder until a relationship loads; its empty ids match no one. */
export function defaultCoachingRelationshipWithUserNames(): CoachingRelationshipWithUserNames {
  const now = DateTime.now();
  return {
    id: "",
    coach_id: "",
    coachee_id: "",
    organization_id: "",
    kind: RelationshipKind.Coaching,
    created_at: now,
    updated_at: now,
    viewer: null,
    suggests_actions: true,
    scheduling_blocked_by: null,
    participants: [
      placeholderParticipant(RelationshipRole.Coach),
      placeholderParticipant(RelationshipRole.Coachee),
    ],
  };
}

function placeholderParticipant(role: RelationshipRole): Participant {
  return { id: "", first_name: "", last_name: "", email: "", role, is_member: true };
}

function hasRole(userId: Id, role: RelationshipRole) {
  return (r: CoachingRelationshipWithUserNames): boolean => {
    const own = roleOf(r, userId);
    return own.some && own.val === role;
  };
}

/**
 * Checks if a user coaches anyone in the provided relationships. Describes the
 * relationships; for what the signed-in user may do, read `viewer`.
 */
export function isUserCoach(userId: Id, relationships: CoachingRelationshipWithUserNames[]): boolean {
  return relationships.some(hasRole(userId, RelationshipRole.Coach));
}

/** Checks if anyone coaches the user in the provided relationships. */
export function isUserCoachee(userId: Id, relationships: CoachingRelationshipWithUserNames[]): boolean {
  return relationships.some(hasRole(userId, RelationshipRole.Coachee));
}

/** The user's colleague relationships. */
export function getColleagueRelationships(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): CoachingRelationshipWithUserNames[] {
  return relationships.filter(hasRole(userId, RelationshipRole.Colleague));
}

export function getRelationshipsAsCoach(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): CoachingRelationshipWithUserNames[] {
  return relationships.filter(hasRole(userId, RelationshipRole.Coach));
}

export function getRelationshipsAsCoachee(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): CoachingRelationshipWithUserNames[] {
  return relationships.filter(hasRole(userId, RelationshipRole.Coachee));
}

/**
 * Returns every relationship the user participates in, coaching or colleague.
 */
export function getRelationshipsForUser(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): CoachingRelationshipWithUserNames[] {
  return relationships.filter((r) => r.coach_id === userId || r.coachee_id === userId);
}

function otherPersonName(rel: CoachingRelationshipWithUserNames, userId: Id): string {
  return participantName(otherParticipantOf(rel, userId));
}

/**
 * Sort relationships alphabetically by the other participant's name
 * relative to the given user.
 */
export function sortRelationshipsByParticipantName(
  relationships: CoachingRelationshipWithUserNames[],
  userId: Id
): CoachingRelationshipWithUserNames[] {
  return [...relationships].sort((a, b) =>
    otherPersonName(a, userId).localeCompare(otherPersonName(b, userId))
  );
}
