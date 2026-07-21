import { RelationshipRole } from "@/types/relationship-role";

/**
 * Non-role extents for an after-session lock: locks nobody, or everybody.
 * Composed with `RelationshipRole` to form `AfterSessionLockScope` so the two
 * roles are reused rather than redeclared.
 */
export enum LockExtent {
  None = "None",
  Both = "Both",
}

/** Who an after-session lock applies to: a single role, nobody, or everybody. */
export type AfterSessionLockScope = RelationshipRole | LockExtent;

/** Per-concern after-session lock scopes for a coaching session panel. */
export interface AfterSessionLock {
  /** Goals, Agreements, and action deletion. */
  sections: AfterSessionLockScope;
  /** The "add a new topic" affordance. */
  newTopic: AfterSessionLockScope;
}

/** Nothing locked — the default before a session has ended. */
export const NO_AFTER_SESSION_LOCK: AfterSessionLock = {
  sections: LockExtent.None,
  newTopic: LockExtent.None,
};

/** Whether `viewerRole` falls within `scope`, i.e. is locked. */
export function isLockedFor(
  scope: AfterSessionLockScope,
  viewerRole: RelationshipRole
): boolean {
  switch (scope) {
    case LockExtent.None:
      return false;
    case LockExtent.Both:
      return true;
    case RelationshipRole.Coach:
    case RelationshipRole.Coachee:
      return scope === viewerRole;
  }
}
