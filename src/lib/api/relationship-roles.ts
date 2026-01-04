// Interacts with the relationship-roles endpoints for fetching user coaching role information

import useSWR from "swr";
import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { sessionGuard } from "@/lib/auth/session-guard";

const USERS_BASEURL: string = `${siteConfig.env.backendServiceURL}/users`;

/**
 * Summary of a user's coaching roles across all relationships.
 */
export interface RelationshipRolesSummary {
  is_coach: boolean;
  is_coachee: boolean;
  coach_relationship_count: number;
  coachee_relationship_count: number;
}

/**
 * API client for fetching relationship role information.
 */
export const RelationshipRolesApi = {
  /**
   * Fetches a summary of the user's coaching roles.
   *
   * @param userId The ID of the user
   * @returns Promise resolving to the relationship roles summary
   */
  getSummary: async (userId: Id): Promise<RelationshipRolesSummary> => {
    const response = await sessionGuard.get<{ data: RelationshipRolesSummary }>(
      `${USERS_BASEURL}/${userId}/relationship-roles-summary`
    );
    return response.data.data;
  },
};

/**
 * Hook to fetch a user's relationship roles.
 *
 * @param userId The ID of the user. If null, no fetch will occur.
 * @returns Object containing role flags, loading state, and error state
 */
export const useRelationshipRoles = (userId: Id | null) => {
  const url = userId ? `${USERS_BASEURL}/${userId}/relationship-roles-summary` : null;

  const { data, error, isLoading } = useSWR<RelationshipRolesSummary>(
    url,
    () => (userId ? RelationshipRolesApi.getSummary(userId) : Promise.reject()),
    { revalidateOnFocus: false }
  );

  return {
    isCoach: data?.is_coach ?? false,
    isCoachee: data?.is_coachee ?? false,
    coachRelationshipCount: data?.coach_relationship_count ?? 0,
    coacheeRelationshipCount: data?.coachee_relationship_count ?? 0,
    isLoading,
    isError: !!error,
  };
};
