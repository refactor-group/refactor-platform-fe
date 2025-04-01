// Interacts with the agreement endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { Agreement, defaultAgreement } from "@/types/agreement";
import { transformEntityDates } from "@/types/general";
import { EntityApi } from "./entity-api";

const AGREEMENTS_BASEURL: string = `${siteConfig.env.backendServiceURL}/agreements`;

/**
 * API client for agreement-related operations.
 *
 * This object provides a collection of functions for interacting with the agreement endpoints
 * on the backend service. It handles the HTTP requests and response parsing for all CRUD operations.
 */
export const AgreementApi = {
  /*
   * Fetches a list of agreements associated with a specific user.
   *
   * @param userId The ID of the user whose agreement should be retrieved
   * @returns Promise resolving to an array of Agreement objects
   */
  list: async (coachingSessionId: Id): Promise<Agreement[]> =>
    EntityApi.listFn<Agreement>(AGREEMENTS_BASEURL, {
      params: { coaching_session_id: coachingSessionId },
    }),

  /**
   * Fetches a single agreement by its ID.
   *
   * @param id The ID of the agreement to retrieve
   * @returns Promise resolving to the Agreement object
   */
  get: async (id: Id): Promise<Agreement> =>
    EntityApi.getFn<Agreement>(`${AGREEMENTS_BASEURL}/${id}`),

  /**
   * Creates a new agreement.
   *
   * @param agreement The agreement data to create
   * @returns Promise resolving to the created Agreement object
   */
  create: async (agreement: Agreement): Promise<Agreement> =>
    EntityApi.createFn<Agreement, Agreement>(AGREEMENTS_BASEURL, agreement),

  createNested: async (_id: Id, _entity: Agreement): Promise<Agreement> => {
    throw new Error("Create nested operation not implemented");
  },

  /**
   * Updates an existing agreement.
   *
   * @param id The ID of the agreement to update
   * @param agreement The updated agreement data
   * @returns Promise resolving to the updated Agreement object
   */
  update: async (id: Id, agreement: Agreement): Promise<Agreement> =>
    EntityApi.updateFn<Agreement, Agreement>(
      `${AGREEMENTS_BASEURL}/${id}`,
      agreement
    ),

  /**
   * Deletes an agreement.
   *
   * @param id The ID of the agreement to delete
   * @returns Promise resolving to the deleted Agreement object
   */
  delete: async (id: Id): Promise<Agreement> =>
    EntityApi.deleteFn<null, Agreement>(`${AGREEMENTS_BASEURL}/${id}`),

  /**
   * Deletes an agreement nested under another entity (foreign key relationship).
   *
   * @param entityId The ID of the entity under which to delete the agreement
   * @param agreementId The ID of the agreement to delete
   * @returns Promise resolving to the deleted Agreement object
   */
  deleteNested: async (entityId: Id, agreementId: Id): Promise<Agreement> => {
    throw new Error("Delete nested operation not implemented");
  },
};

/**
 * A custom React hook that fetches a list of agreements for a specific user.
 *
 * This hook uses SWR to efficiently fetch, cache, and revalidate agreement data.
 * It automatically refreshes data when the component mounts.
 *
 * @param coachingSessionId The ID of the coachingSessionId whose agreements should be fetched
 * @returns An object containing:
 *
 * * agreements: Array of Agreement objects (empty array if data is not yet loaded)
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useAgreementList = (coachingSessionId: Id) => {
  const { entities, isLoading, isError, refresh } = EntityApi.useEntityList<
    Agreement,
    Agreement
  >(
    AGREEMENTS_BASEURL,
    () => AgreementApi.list(coachingSessionId),
    transformEntityDates,
    coachingSessionId
  );

  return {
    agreements: entities,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * A custom React hook that fetches a single agreement by its ID.
 * This hook uses SWR to efficiently fetch and cache agreement data.
 * It does not automatically revalidate the data on window focus, reconnect, or when data becomes stale.
 *
 * @param id The ID of the agreement to fetch. If null or undefined, no fetch will occur.
 * @returns An object containing:
 *
 * * agreement: The fetched Agreement object, or a default agreement if not yet loaded
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useAgreement = (id: Id) => {
  const url = id ? `${AGREEMENTS_BASEURL}/${id}` : null;
  const fetcher = () => AgreementApi.get(id);

  const { entity, isLoading, isError, refresh } =
    EntityApi.useEntity<Agreement>(url, fetcher, defaultAgreement());

  return {
    agreement: entity,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * A custom React hook that fetches a single agreement by coaching session ID.
 * This hook uses SWR to efficiently fetch and cache agreement data.
 * It does not automatically revalidate the data on window focus, reconnect, or when data becomes stale.
 *
 * @param coachingSessionId The coaching session ID of the agreement to fetch. If null or undefined, no fetch will occur.
 * @returns An object containing:
 *
 * * agreement: The fetched Agreement object, or a default agreement if not yet loaded
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useAgreementBySession = (coachingSessionId: Id) => {
  const { agreements, isLoading, isError, refresh } =
    useAgreementList(coachingSessionId);

  return {
    agreement: agreements.length ? agreements[0] : defaultAgreement(),
    isLoading,
    isError: isError,
    refresh,
  };
};

/**
 * A custom React hook that provides mutation operations for agreements with loading and error state management.
 * This hook simplifies creating, updating, and deleting agreements while handling loading states,
 * error management, and cache invalidation automatically.
 *
 * @returns An object containing:
 * create: Function to create a new agreement
 * update: Function to update an existing agreement
 * delete: Function to delete an agreement
 * isLoading: Boolean indicating if any operation is in progress
 * error: Error object if the last operation failed, null otherwise
 */
export const useAgreementMutation = () => {
  return EntityApi.useEntityMutation<Agreement>(AGREEMENTS_BASEURL, {
    create: AgreementApi.create,
    createNested: AgreementApi.createNested,
    update: AgreementApi.update,
    delete: AgreementApi.delete,
    deleteNested: AgreementApi.deleteNested,
  });
};
