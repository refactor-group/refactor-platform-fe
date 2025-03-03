// Interacts with the Organizations endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { Organization, defaultOrganization } from "@/types/organization";
import axios from "axios";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";

interface ApiResponse<T> {
  status_code: number;
  data: T;
}

// Generic fetcher function
const fetcher = async <T>(url: string, config?: any): Promise<T> =>
  axios
    .get<ApiResponse<T>>(url, {
      withCredentials: true,
      timeout: 5000,
      headers: {
        "X-Version": siteConfig.env.backendApiVersion,
      },
      ...config,
    })
    .then((res) => res.data.data);

// Type-safe mutation function for manipulating Organization data
const mutationFn = async <T, R>(
  method: "post" | "put" | "delete",
  url: string,
  data?: T
): Promise<R> => {
  const config = {
    withCredentials: true,
    timeout: 5000,
    headers: {
      "X-Version": siteConfig.env.backendApiVersion,
    },
  };

  let response;
  if (method === "delete") {
    response = await axios.delete<ApiResponse<R>>(url, config);
  } else if (method === "put" && data) {
    response = await axios.put<ApiResponse<R>>(url, data, config);
  } else if (data) {
    response = await axios.post<ApiResponse<R>>(url, data, config);
  } else {
    throw new Error("Invalid method or missing data");
  }

  return response.data.data;
};

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
    fetcher<Organization[]>(
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
    fetcher<Organization>(
      `${siteConfig.env.backendServiceURL}/organizations/${id}`
    ),

  /**
   * Creates a new organization.
   *
   * @param organization The organization data to create
   * @returns Promise resolving to the created Organization object
   */
  create: async (organization: Organization): Promise<Organization> =>
    mutationFn<Organization, Organization>(
      "post",
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
    mutationFn<Organization, Organization>(
      "put",
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
    mutationFn<null, Organization>(
      "delete",
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
  const { data, error, isLoading, mutate } = useSWR<Organization[]>(
    [`${siteConfig.env.backendServiceURL}/organizations`, userId],
    () => OrganizationAPI.list(userId),
    { revalidateOnMount: true }
  );

  return {
    organizations: Array.isArray(data) ? data : [],
    isLoading,
    isError: error,
    refresh: mutate,
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
  const { data, error, isLoading, mutate } = useSWR<Organization>(
    id ? `${siteConfig.env.backendServiceURL}/organizations/${id}` : null,
    () => OrganizationAPI.get(id),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    organization: data || defaultOrganization(),
    isLoading,
    isError: error,
    refresh: mutate,
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
export const useOrganizationMutation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { mutate } = useSWRConfig();

  /**
   * Executes an async operation while managing loading and error states.
   * Also invalidates the organization cache after successful operations.
   *
   * @template T The return type of the operation
   * @param operation A function that returns a Promise
   * @returns A Promise that resolves to the operation result
   * @throws The original error from the operation
   */
  const executeWithState = async <T>(
    operation: () => Promise<T>
  ): Promise<T> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await operation();
      // Refresh organization lists
      mutate(
        (key) =>
          typeof key === "string" &&
          key.includes(`${siteConfig.env.backendServiceURL}/organizations`)
      );
      return result;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Unknown error occurred")
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    /**
     * Creates a new organization.
     *
     * @param organization The organization data to create
     * @returns Promise resolving to the created organization
     */
    create: (organization: Organization) =>
      executeWithState(() => OrganizationAPI.create(organization)),
    /**
     * Updates an existing organization.
     *
     * @param id The ID of the organization to update
     * @param organization The updated organization data
     * @returns Promise resolving to the updated organization
     */
    update: (id: Id, organization: Organization) =>
      executeWithState(() => OrganizationAPI.update(id, organization)),
    /**
     * Deletes an organization.
     *
     * @param id The ID of the organization to delete
     * @returns Promise resolving to the deleted organization
     */
    delete: (id: Id) => executeWithState(() => OrganizationAPI.delete(id)),
    /** Indicates if any operation is currently in progress */
    isLoading,
    /** Contains the error if the last operation failed, null otherwise */
    error,
  };
};
