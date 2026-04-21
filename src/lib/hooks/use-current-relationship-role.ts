"use client";

import { useMemo } from 'react';
import { useAuthStore } from '@/lib/providers/auth-store-provider';
import { useCurrentCoachingRelationship } from './use-current-coaching-relationship';
import { RelationshipRole } from '@/types/relationship-role';
import { type Option, Some, None } from '@/types/option';

/**
 * Centralized hook for determining the current user's role in the active coaching relationship.
 * Provides relationship-specific role information for contextual UI logic.
 *
 * `relationship_role` is `Option<RelationshipRole>`: None until the coaching relationship
 * has loaded, then Some(Coach|Coachee). Callers must not assume the role is known on first
 * render — treat None as "not yet determined" and gate presence broadcasts accordingly.
 *
 * Note: This differs from the global `isACoach` flag which indicates if the user
 * is a coach in ANY relationship across the organization.
 *
 * @returns Object containing current relationship role information
 */
export const useCurrentRelationshipRole = () => {
  const { userSession } = useAuthStore((state) => ({ userSession: state.userSession }));
  const { currentCoachingRelationship } = useCurrentCoachingRelationship();

  return useMemo((): {
    relationship_role: Option<RelationshipRole>;
    isCoachInCurrentRelationship: boolean;
    isCoacheeInCurrentRelationship: boolean;
    hasActiveRelationship: boolean;
    relationshipId: string | undefined;
    userId: string | undefined;
    coachId: string | undefined;
    coacheeId: string | undefined;
  } => {
    if (!currentCoachingRelationship) {
      // Relationship not yet loaded — role is genuinely unknown, not a default
      return {
        relationship_role: None,
        isCoachInCurrentRelationship: false,
        isCoacheeInCurrentRelationship: false,
        hasActiveRelationship: false,
        relationshipId: undefined,
        userId: userSession?.id,
        coachId: undefined,
        coacheeId: undefined,
      };
    }

    const isCoachInCurrentRelationship = currentCoachingRelationship.coach_id === userSession?.id;

    return {
      // Current relationship-specific role (for presence indicators, session UI)
      relationship_role: Some(isCoachInCurrentRelationship ? RelationshipRole.Coach : RelationshipRole.Coachee),

      // Boolean flags for current relationship context
      isCoachInCurrentRelationship,
      isCoacheeInCurrentRelationship: !isCoachInCurrentRelationship,

      // Additional context for current relationship
      hasActiveRelationship: true,
      relationshipId: currentCoachingRelationship.id,
      userId: userSession?.id,

      // Coach/coachee IDs for current relationship
      coachId: currentCoachingRelationship.coach_id,
      coacheeId: currentCoachingRelationship.coachee_id,
    };
  }, [currentCoachingRelationship, userSession?.id]);
};