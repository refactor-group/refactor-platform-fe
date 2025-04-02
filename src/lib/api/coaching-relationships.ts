// Interacts with the coaching_relationship endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import {
  CoachingRelationshipWithUserNames,
  defaultCoachingRelationshipWithUserNames,
} from "@/types/coaching_relationship_with_user_names";
import { EntityApi } from "./entity-api";

const ORGANIZATIONS_BASEURL: string = `${siteConfig.env.backendServiceURL}/organizations`;
const COACHING_RELATIONSHIPS_BASEURL: string = `coaching_relationships`;

/**
 * API client for organization-related operations.
 *
 * This object provides a collection of functions for interacting with the organization endpoints
 * on the backend service. It handles the HTTP requests and response parsing for all CRUD operations.
 */
export const CoachingRelationshipApi = {
  /*
   * Fetches a list of coaching relationships associated with a specific organization.
   *
   * @param organizationId The ID of the organization under which to retrieve all coaching relationships
   * @returns Promise resolving to an array of CoachingRelationshipsWithUserNames objects
   */
  list: async (
    organizationId: Id
  ): Promise<CoachingRelationshipWithUserNames[]> =>
    EntityApi.listFn<CoachingRelationshipWithUserNames>(
      `${ORGANIZATIONS_BASEURL}/${organizationId}/${COACHING_RELATIONSHIPS_BASEURL}`,
      {
        params: { organization_id: organizationId },
      }
    ),

  /**
   * Fetches a single coaching relationship by its ID.
   *
   * @param organizationId The ID of the organization to retrieve a relationship under
   * @param relationshipId The ID of the coaching relationship to retrieve
   * @returns Promise resolving to the CoachingRelationshipWithUserNames object
   */
  get: async (
    organizationId: Id,
    relationshipId: Id
  ): Promise<CoachingRelationshipWithUserNames> =>
    EntityApi.getFn<CoachingRelationshipWithUserNames>(
      `${ORGANIZATIONS_BASEURL}/${organizationId}/${COACHING_RELATIONSHIPS_BASEURL}/${relationshipId}`
    ),

  /**
   * Unimplemented
   */
  create: async (
    _relationship: CoachingRelationshipWithUserNames
  ): Promise<CoachingRelationshipWithUserNames> => {
    throw new Error("Create operation not implemented");
  },

  /**
   * Creates a new coaching relationship.
   *
   * @param organizationId The organization ID under which to create the new coaching relationship
   * @param relationship The coaching relationship data to create
   * @returns Promise resolving to the created CoachingRelationshipWithUserNames object
   */
  createNested: async (
    organizationId: Id,
    entity: CoachingRelationshipWithUserNames
  ): Promise<CoachingRelationshipWithUserNames> => {
    return EntityApi.createFn<
      CoachingRelationshipWithUserNames,
      CoachingRelationshipWithUserNames
    >(
      `${ORGANIZATIONS_BASEURL}/${organizationId}/${COACHING_RELATIONSHIPS_BASEURL}`,
      entity
    );
  },

  /**
   * Unimplemented
   */
  update: async (_id: Id, entity: CoachingRelationshipWithUserNames) => {
    throw new Error("Update operation not implemented");
  },

  /**
   * Unimplemented
   */
  delete: async (_id: Id) => {
    throw new Error("Delete operation not implemented");
  },

  /**
   * Deletes a coaching relationship nested under another entity (foreign key relationship).
   *
   * @param entityId The ID of the entity under which to delete the coaching relationship
   * @param relationshipId The ID of the coaching relationship to delete
   * @returns Promise resolving to the deleted CoachingRelationshipWithUserNames object
   */
  deleteNested: async (
    _organizationId: Id,
    _relationshipId: Id
  ): Promise<CoachingRelationshipWithUserNames> => {
    throw new Error("Delete nested operation not implemented");
  },
};

/**
 * A custom React hook that fetches a list of coaching relationships for a specific organization.
 *
 * This hook uses SWR to efficiently fetch, cache, and revalidate coaching relationship data.
 * It automatically refreshes data when the component mounts.
 *
 * @param organizationId The ID of the organization whose coaching relationships should be fetched
 * @returns An object containing:
 *
 * * relationships: Array of CoachingRelationshipWithUserNames objects (empty array if data is not yet loaded)
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useCoachingRelationshipList = (organizationId: Id) => {
  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<CoachingRelationshipWithUserNames>(
      `${ORGANIZATIONS_BASEURL}/${organizationId}/${COACHING_RELATIONSHIPS_BASEURL}`,
      () => CoachingRelationshipApi.list(organizationId),
      organizationId
    );

  return {
    relationships: entities,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * A custom React hook that fetches a single coaching relationship by its ID.
 * This hook uses SWR to efficiently fetch and cache organization data.
 * It does not automatically revalidate the data on window focus, reconnect, or when data becomes stale.
 *
 * @param organizationId The ID of the organization under which to fetch the coaching relationship. If null or undefined, no fetch will occur.
 * @param relationshipId The ID of the coaching relationship to fetch. If null or undefined, no fetch will occur.
 * @returns An object containing:
 *
 * * relationship: The fetched CoachingRelationshipWithUserNames object, or a default relationship if not yet loaded
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useCoachingRelationship = (
  organizationId: Id,
  relationshipId: Id
) => {
  const url =
    organizationId && relationshipId
      ? `${ORGANIZATIONS_BASEURL}/${organizationId}/${COACHING_RELATIONSHIPS_BASEURL}/${relationshipId}`
      : null;
  const fetcher = () =>
    CoachingRelationshipApi.get(organizationId, relationshipId);

  const { entity, isLoading, isError, refresh } =
    EntityApi.useEntity<CoachingRelationshipWithUserNames>(
      url,
      fetcher,
      defaultCoachingRelationshipWithUserNames()
    );

  return {
    relationship: entity,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * A custom React hook that provides mutation operations for coaching relationships with loading and error state management.
 * This hook simplifies creating coaching relationships while handling loading states,
 * error management, and cache invalidation automatically.
 *
 * @returns An object containing:
 * create: Function to create a new coaching relationship
 * isLoading: Boolean indicating if any operation is in progress
 * error: Error object if the last operation failed, null otherwise
 */
/**
 * Hook for coaching relationship mutations.
 * Provides methods to create, update, and delete coaching relationships.
 */
export const useCoachingRelationshipMutation = (organizationId: Id) => {
  return EntityApi.useEntityMutation<CoachingRelationshipWithUserNames>(
    `${ORGANIZATIONS_BASEURL}/${organizationId}/${COACHING_RELATIONSHIPS_BASEURL}`,
    {
      create: CoachingRelationshipApi.create,
      createNested: CoachingRelationshipApi.createNested,
      update: CoachingRelationshipApi.update,
      delete: CoachingRelationshipApi.delete,
      deleteNested: CoachingRelationshipApi.deleteNested,
    }
  );
};
