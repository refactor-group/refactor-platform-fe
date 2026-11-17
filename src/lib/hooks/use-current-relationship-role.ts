"use client";

import { useMemo } from 'react';
import { useCurrentCoachingRelationship } from './use-current-coaching-relationship';
import { RelationshipRole } from '@/types/relationship-role';
import { None, Some, type Option } from '@/types/option';
import { viewerOf } from '@/types/coaching-relationship';

/**
 * The signed-in user's role and permissions in the active relationship, as the backend
 * computed them. Display only; the backend enforces.
 *
 * `relationship_role` is None until the relationship loads (or for a non-participant).
 * Callers must not assume the role is known on first render: treat None as "not yet
 * determined" and gate presence broadcasts accordingly.
 *
 * Note: This differs from the global `isACoach` flag, which says whether the user
 * coaches anyone in the organization.
 */
export const useCurrentRelationshipRole = () => {
  const { currentCoachingRelationship } = useCurrentCoachingRelationship();

  return useMemo((): {
    relationship_role: Option<RelationshipRole>;
    canScheduleSessions: boolean;
    seesAllActions: boolean;
    /** Recording is open to either participant; coaching keeps the controls with the coach. */
    controlsRecording: boolean;
  } => {
    const viewer = currentCoachingRelationship ? viewerOf(currentCoachingRelationship) : None;
    if (viewer.none) {
      return { relationship_role: None, canScheduleSessions: false, seesAllActions: false, controlsRecording: false };
    }
    return {
      relationship_role: Some(viewer.val.role),
      canScheduleSessions: viewer.val.can_schedule_sessions,
      seesAllActions: viewer.val.sees_all_actions,
      controlsRecording: viewer.val.role !== RelationshipRole.Coachee,
    };
  }, [currentCoachingRelationship]);
};
