// Interacts with the Organizations endpoints

import { useState } from "react";
import { useSWRConfig } from "swr";
import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import {
  Organization,
  OrganizationStatusFilter,
  defaultOrganization,
} from "@/types/organization";
import { EntityApi } from "./entity-api";

export const ORGANIZATIONS_BASEURL: string = `${siteConfig.env.backendServiceURL}/organizations`;

/**
 * API client for organization-related operations.
 *
 * This object provides a collection of functions for interacting with the organization endpoints
 * on the backend service. It handles the HTTP requests and response parsing for all CRUD operations.
 */
export const OrganizationApi = {
  /*
   * Fetches a list of organizations associated with a specific user.
   *
   * @param userId The ID of the user whose organizations should be retrieved
   * @returns Promise resolving to an array of Organization objects
   */
  list: async (userId: Id): Promise<Organization[]> =>
    EntityApi.listFn<Organization>(ORGANIZATIONS_BASEURL, {
      params: { user_id: userId },
    }),

  /*
   * Fetches every organization on the platform. SuperAdmin-gated on the backend
   * (no user_id scoping); a 403 is expected for any non-SuperAdmin caller.
   *
   * @param status Which lifecycle subset to return (active | archived | all);
   *   the backend defaults to active when the param is omitted.
   * @returns Promise resolving to an array of all Organization objects
   */
  listAll: async (
    status: OrganizationStatusFilter = OrganizationStatusFilter.Active
  ): Promise<Organization[]> =>
    EntityApi.listFn<Organization>(ORGANIZATIONS_BASEURL, {
      params: { status },
    }),

  /**
   * Archives an organization (reversible). Sets archived_at server-side; the org
   * drops out of active reads but keeps all data. SuperAdmin-gated, idempotent.
   *
   * @param id The ID of the organization to archive
   * @returns Promise resolving to the updated Organization object
   */
  archive: async (id: Id): Promise<Organization> =>
    EntityApi.createFn<Record<string, never>, Organization>(
      `${ORGANIZATIONS_BASEURL}/${id}/archive`,
      {}
    ),

  /**
   * Reverses an archive, restoring the organization to active. SuperAdmin-gated,
   * idempotent.
   *
   * @param id The ID of the organization to unarchive
   * @returns Promise resolving to the updated Organization object
   */
  unarchive: async (id: Id): Promise<Organization> =>
    EntityApi.createFn<Record<string, never>, Organization>(
      `${ORGANIZATIONS_BASEURL}/${id}/unarchive`,
      {}
    ),

  /**
   * Fetches a single organization by its ID.
   *
   * @param id The ID of the organization to retrieve
   * @returns Promise resolving to the Organization object
   */
  get: async (id: Id): Promise<Organization> =>
    EntityApi.getFn<Organization>(`${ORGANIZATIONS_BASEURL}/${id}`),

  /**
   * Creates a new organization.
   *
   * @param organization The organization data to create
   * @returns Promise resolving to the created Organization object
   */
  create: async (organization: Organization): Promise<Organization> =>
    EntityApi.createFn<Organization, Organization>(
      ORGANIZATIONS_BASEURL,
      organization
    ),

  createNested: async (_id: Id, _entity: Organization): Promise<Organization> => {
    throw new Error("Create nested operation not implemented");
  },

  /**
   * Updates an existing organization.
   *
   * @param id The ID of the organization to update
   * @param organization The updated organization data
   * @returns Promise resolving to the updated Organization object
   */
  update: async (id: Id, organization: Organization): Promise<Organization> =>
    EntityApi.updateFn<Organization, Organization>(
      `${ORGANIZATIONS_BASEURL}/${id}`,
      organization
    ),

  /**
   * Deletes an organization.
   *
   * @param id The ID of the organization to delete
   * @returns Promise resolving to the deleted Organization object
   */
  delete: async (id: Id): Promise<Organization> =>
    EntityApi.deleteFn<null, Organization>(`${ORGANIZATIONS_BASEURL}/${id}`),

  /**
   * Deletes an organization nested under another entity (foreign key relationship).
   *
   * @param entityId The ID of the entity under which to delete the organization
   * @param organizationId The ID of the organization to delete
   * @returns Promise resolving to the deleted Organization object
   */
  deleteNested: async (
    _entityId: Id,
    _organizationId: Id
  ): Promise<Organization> => {
    throw new Error("Delete nested operation not implemented");
  },
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
      ORGANIZATIONS_BASEURL,
      () => OrganizationApi.list(userId),
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
 * A custom React hook that fetches every organization on the platform.
 *
 * SuperAdmin-only: the backend returns 403 for non-SuperAdmin callers, surfaced
 * here as `isError`. The `status` is part of the SWR key, so the active /
 * archived / all subsets cache independently and never collide with the
 * per-user {@link useOrganizationList} cache.
 *
 * @param status Which lifecycle subset to fetch (defaults to active)
 * @returns An object containing:
 * * organizations: Array of all Organization objects (empty until loaded)
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch failed (e.g. 403 for non-SuperAdmins)
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useAllOrganizations = (
  status: OrganizationStatusFilter = OrganizationStatusFilter.Active
) => {
  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<Organization>(
      ORGANIZATIONS_BASEURL,
      () => OrganizationApi.listAll(status),
      ["all", status]
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
  const url = id ? `${ORGANIZATIONS_BASEURL}/${id}` : null;
  const fetcher = () => OrganizationApi.get(id);

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
  return EntityApi.useEntityMutation<Organization>(ORGANIZATIONS_BASEURL, {
    create: OrganizationApi.create,
    createNested: OrganizationApi.createNested,
    update: OrganizationApi.update,
    delete: OrganizationApi.delete,
    deleteNested: OrganizationApi.deleteNested,
  });
};

/**
 * Hook for the archive/unarchive lifecycle actions, which are sub-action POSTs
 * rather than standard CRUD and so don't flow through {@link useOrganizationMutation}.
 * Each call invalidates every organization cache — including the sibling
 * active/archived/all {@link useAllOrganizations} keys — so switching status
 * tabs after a toggle reflects the change without waiting for a stale-revalidate.
 *
 * @returns An object containing:
 * * archive: Archives an organization by id
 * * unarchive: Restores an archived organization by id
 * * isLoading: Boolean indicating if a toggle is in progress
 */
export const useOrganizationArchiveMutation = () => {
  const { mutate } = useSWRConfig();
  const [isLoading, setIsLoading] = useState(false);

  const run = async (operation: () => Promise<Organization>) => {
    setIsLoading(true);
    try {
      const result = await operation();
      EntityApi.invalidateEntityCache(mutate, ORGANIZATIONS_BASEURL);
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    archive: (id: Id) => run(() => OrganizationApi.archive(id)),
    unarchive: (id: Id) => run(() => OrganizationApi.unarchive(id)),
    isLoading,
  };
};
