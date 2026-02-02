/**
 * Hook to determine a user's coaching roles (coach/coachee) within an organization.
 *
 * Derives role information from the organization's coaching relationships endpoint:
 * GET /organizations/:org_id/coaching_relationships
 */

import { Id } from "@/types/general";
import {
  CoachingRelationshipWithUserNames,
  getRelationshipsAsCoach,
  getRelationshipsAsCoachee,
} from "@/types/coaching-relationship";
import { useCoachingRelationshipList } from "./coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";

/**
 * Summary of a user's coaching roles derived from their relationships.
 */
export interface UserCoachingRolesSummary {
  isCoach: boolean;
  isCoachee: boolean;
  coachRelationshipCount: number;
  coacheeRelationshipCount: number;
}

/**
 * Derives role summary from a list of relationships for a given user.
 *
 * @param userId The ID of the user
 * @param relationships The organization's coaching relationships
 * @returns Summary of the user's coaching roles
 */
export function deriveRolesSummary(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): UserCoachingRolesSummary {
  const coachRelationships = getRelationshipsAsCoach(userId, relationships);
  const coacheeRelationships = getRelationshipsAsCoachee(userId, relationships);

  return {
    isCoach: coachRelationships.length > 0,
    isCoachee: coacheeRelationships.length > 0,
    coachRelationshipCount: coachRelationships.length,
    coacheeRelationshipCount: coacheeRelationships.length,
  };
}

/**
 * Hook to fetch a user's coaching role summary within the current organization.
 *
 * Uses the existing organization coaching relationships endpoint and filters
 * to determine if the user is a coach or coachee.
 *
 * @param userId The ID of the user. If null, no fetch will occur.
 * @returns Object containing role flags, counts, loading state, and error state
 */
export const useUserCoachingRoles = (userId: Id | null) => {
  const { currentOrganizationId } = useCurrentOrganization();
  const { relationships, isLoading, isError, refresh } =
    useCoachingRelationshipList(currentOrganizationId ?? "");

  const summary =
    userId && currentOrganizationId
      ? deriveRolesSummary(userId, relationships)
      : {
          isCoach: false,
          isCoachee: false,
          coachRelationshipCount: 0,
          coacheeRelationshipCount: 0,
        };

  return {
    ...summary,
    relationships,
    isLoading,
    isError,
    refresh,
  };
};
