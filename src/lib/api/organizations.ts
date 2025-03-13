// Interacts with the Organizations endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { Organization, defaultOrganization } from "@/types/organization";
import { EntityApi } from "./entity-api";

/**
 * API client for organization-related operations.
 *
 * This object provides a collection of functions for interacting with the organization endpoints
 * on the backend service. It handles the HTTP requests and response parsing for all CRUD operations.
 */
export const OrganizationAPI = {
  /*
   * Fetches a list of organizations associated with a specific user.
   *
   * @param userId The ID of the user whose organizations should be retrieved
   * @returns Promise resolving to an array of Organization objects
   */
  list: async (userId: Id): Promise<Organization[]> =>
    EntityApi.listFn<Organization>(
      `${siteConfig.env.backendServiceURL}/organizations`,
      {
        params: { user_id: userId },
      }
    ),

  /**
   * Fetches a single organization by its ID.
   *
   * @param id The ID of the organization to retrieve
   * @returns Promise resolving to the Organization object
   */
  get: async (id: Id): Promise<Organization> =>
    EntityApi.getFn<Organization>(
      `${siteConfig.env.backendServiceURL}/organizations/${id}`
    ),

  /**
   * Creates a new organization.
   *
   * @param organization The organization data to create
   * @returns Promise resolving to the created Organization object
   */
  create: async (organization: Organization): Promise<Organization> =>
    EntityApi.createFn<Organization, Organization>(
      `${siteConfig.env.backendServiceURL}/organizations`,
      organization
    ),

  /**
   * Updates an existing organization.
   *
   * @param id The ID of the organization to update
   * @param organization The updated organization data
   * @returns Promise resolving to the updated Organization object
   */
  update: async (id: Id, organization: Organization): Promise<Organization> =>
    EntityApi.updateFn<Organization, Organization>(
      `${siteConfig.env.backendServiceURL}/organizations/${id}`,
      organization
    ),

  /**
   * Deletes an organization.
   *
   * @param id The ID of the organization to delete
   * @returns Promise resolving to the deleted Organization object
   */
  delete: async (id: Id): Promise<Organization> =>
    EntityApi.deleteFn<null, Organization>(
      `${siteConfig.env.backendServiceURL}/organizations/${id}`
    ),
};

/**
 * A custom React hook that fetches a list of organizations for a specific user.
 *
 * This hook uses SWR to efficiently fetch, cache, and revalidate organization data.
 * It automatically refreshes data when the component mounts.
 *
 * @param userId The ID of the user whose organizations should be fetched
 * @returns An object containing:
 *
 * * organizations: Array of Organization objects (empty array if data is not yet loaded)
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useOrganizationList = (userId: Id) => {
  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<Organization>(
      `${siteConfig.env.backendServiceURL}/organizations`,
      () => OrganizationAPI.list(userId),
      userId
    );

  return {
    organizations: entities,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * A custom React hook that fetches a single organization by its ID.
 * This hook uses SWR to efficiently fetch and cache organization data.
 * It does not automatically revalidate the data on window focus, reconnect, or when data becomes stale.
 *
 * @param id The ID of the organization to fetch. If null or undefined, no fetch will occur.
 * @returns An object containing:
 *
 * * organization: The fetched Organization object, or a default organization if not yet loaded
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useOrganization = (id: Id) => {
  const url = id
    ? `${siteConfig.env.backendServiceURL}/organizations/${id}`
    : null;
  const fetcher = () => OrganizationAPI.get(id);

  const { entity, isLoading, isError, refresh } =
    EntityApi.useEntity<Organization>(url, fetcher, defaultOrganization());

  return {
    organization: entity,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * A custom React hook that provides mutation operations for organizations with loading and error state management.
 * This hook simplifies creating, updating, and deleting organizations while handling loading states,
 * error management, and cache invalidation automatically.
 *
 * @returns An object containing:
 * create: Function to create a new organization
 * update: Function to update an existing organization
 * delete: Function to delete an organization
 * isLoading: Boolean indicating if any operation is in progress
 * error: Error object if the last operation failed, null otherwise
 */
/**
 * Hook for organization mutations.
 * Provides methods to create, update, and delete organizations.
 */
export const useOrganizationMutation = () => {
  return EntityApi.useEntityMutation<Organization>(
    `${siteConfig.env.backendServiceURL}/organizations`,
    {
      create: OrganizationAPI.create,
      update: OrganizationAPI.update,
      delete: OrganizationAPI.delete,
    }
  );
};
