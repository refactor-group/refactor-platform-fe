import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";
import { User } from "@/types/user";
import { type Option, None, Some } from "@/types/option";
import { RelationshipRole } from "@/types/relationship-role";

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
  /** False once they leave the organization: nothing new can be scheduled with or assigned to them. */
  coach_is_member: boolean;
  coachee_is_member: boolean;
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
  coach_first_name: string;
  coach_last_name: string;
  coachee_first_name: string;
  coachee_last_name: string;
};

/**
 * Relationship with embedded coach and coachee user data
 * Matches backend RelationshipWithUsers response from the enhanced endpoint
 *
 * This must always reflect the Rust struct on the backend
 * web::response::coaching_session::RelationshipWithUsers
 *
 * Note: This is different from CoachingRelationshipWithUserNames which only
 * contains name fields. This type contains full User objects.
 */
export type CoachingRelationshipWithUsers = CoachingRelationship & {
  coach: User;
  coachee: User;
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

export function isCoachingRelationshipWithUserNames(
  value: unknown
): value is CoachingRelationshipWithUserNames {
  if (!value || typeof value !== "object") {
    return false;
  }
  const object = value as Record<string, unknown>;

  return (
    typeof object.id === "string" &&
    typeof object.coach_id === "string" &&
    typeof object.coachee_id === "string" &&
    typeof object.coach_first_name === "string" &&
    typeof object.coach_last_name === "string" &&
    typeof object.coachee_first_name === "string" &&
    typeof object.coachee_last_name === "string" &&
    typeof object.created_at === "string" &&
    typeof object.updated_at === "string"
  );
}

export function isCoachingRelationshipWithUserNamesArray(
  value: unknown
): value is CoachingRelationshipWithUserNames[] {
  return (
    Array.isArray(value) && value.every(isCoachingRelationshipWithUserNames)
  );
}

export function getCoachingRelationshipById(
  id: string,
  relationships: CoachingRelationshipWithUserNames[]
): CoachingRelationshipWithUserNames {
  const relationship = relationships.find(
    (relationship) => relationship.id === id
  );
  return relationship
    ? relationship
    : defaultCoachingRelationshipWithUserNames();
}

export function defaultCoachingRelationshipWithUserNames(): CoachingRelationshipWithUserNames {
  var now = DateTime.now();
  return {
    id: "",
    coach_id: "",
    coachee_id: "",
    coach_first_name: "",
    coach_last_name: "",
    organization_id: "",
    kind: RelationshipKind.Coaching,
    coachee_first_name: "",
    coachee_last_name: "",
    created_at: now,
    updated_at: now,
    coach_is_member: true,
    coachee_is_member: true,
    viewer: null,
    suggests_actions: true,
    scheduling_blocked_by: null,
  };
}

export function defaultCoachingRelationshipsWithUserNames(): CoachingRelationshipWithUserNames[] {
  return [defaultCoachingRelationshipWithUserNames()];
}

export function coachingRelationshipWithUserNamesToString(
  relationship: CoachingRelationshipWithUserNames | undefined
): string {
  return JSON.stringify(relationship);
}

export function coachingRelationshipsWithUserNamesToString(
  relationships: CoachingRelationshipWithUserNames[] | undefined
): string {
  return JSON.stringify(relationships);
}

const isCoaching = (r: CoachingRelationship): boolean => r.kind !== RelationshipKind.Colleague;

/**
 * Checks if a user coaches anyone in the provided relationships. Describes the
 * relationships; for what the signed-in user may do, read `viewer`.
 */
export function isUserCoach(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): boolean {
  return relationships.some(r => isCoaching(r) && r.coach_id === userId);
}

/**
 * Checks if anyone coaches the user in the provided relationships
 */
export function isUserCoachee(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): boolean {
  return relationships.some(r => isCoaching(r) && r.coachee_id === userId);
}

/** The user's colleague relationships. */
export function getColleagueRelationships(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): CoachingRelationshipWithUserNames[] {
  return relationships.filter(r => !isCoaching(r) && (r.coach_id === userId || r.coachee_id === userId));
}

/**
 * Checks if a user is the coach in a single relationship
 */
export function isUserCoachInRelationship(
  userId: Id,
  relationship: CoachingRelationshipWithUserNames
): boolean {
  return relationship.coach_id === userId;
}

/**
 * Checks if a user is the coachee in a single relationship
 */
export function isUserCoacheeInRelationship(
  userId: Id,
  relationship: CoachingRelationshipWithUserNames
): boolean {
  return relationship.coachee_id === userId;
}

/**
 * Returns all relationships where the user is the coach
 */
export function getRelationshipsAsCoach(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): CoachingRelationshipWithUserNames[] {
  return relationships.filter(r => isCoaching(r) && r.coach_id === userId);
}

/**
 * Returns all relationships where the user is the coachee
 */
export function getRelationshipsAsCoachee(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): CoachingRelationshipWithUserNames[] {
  return relationships.filter(r => isCoaching(r) && r.coachee_id === userId);
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

/**
 * Returns the display name of the other participant in a relationship
 * relative to the given user.
 */
function getOtherPersonName(
  rel: CoachingRelationshipWithUserNames,
  userId: Id
): string {
  if (rel.coach_id === userId) {
    return `${rel.coachee_first_name} ${rel.coachee_last_name}`.trim();
  }
  return `${rel.coach_first_name} ${rel.coach_last_name}`.trim();
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
    getOtherPersonName(a, userId).localeCompare(getOtherPersonName(b, userId))
  );
}

/** Whether a participant of the relationship is still a member of its organization. */
export function isMember(relationship: CoachingRelationship, userId: Id): boolean {
  if (userId === relationship.coach_id) return relationship.coach_is_member;
  if (userId === relationship.coachee_id) return relationship.coachee_is_member;
  return false;
}

/** The participants no longer in the organization: they keep existing assignments but can't be newly assigned. */
export function nonMemberIdsOf(relationship: CoachingRelationship): Id[] {
  return [relationship.coach_id, relationship.coachee_id].filter((id) => !isMember(relationship, id));
}
