import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import axios from "axios";
import { useState } from "react";
import useSWR, { SWRConfiguration, useSWRConfig } from "swr";

export namespace EntityApi {
  interface ApiResponse<T> {
    status_code: number;
    data: T;
  }

  // Generic fetcher function for fetching Entity data
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

  // Type-safe mutation function for manipulating Entity data
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
   * Fetches a list of entities from the specified URL with optional parameters.
   *
   * @template R The type of entities to be returned in the array
   * @param url The API endpoint URL to fetch data from
   * @param params Optional query parameters to include in the request
   * @returns A Promise resolving to an array of entities of type R
   */
  export const listFn = async <R>(url: string, params: any): Promise<R[]> => {
    return fetcher<R[]>(url, params);
  };

  /**
   * Fetches a single entity from the specified URL.
   *
   * @template R The type of entity to be returned
   * @param url The API endpoint URL to fetch data from
   * @returns A Promise resolving to an entity of type R
   */
  export const getFn = async <R>(url: string): Promise<R> => {
    return fetcher<R>(url);
  };

  /**
   * Creates a new entity by sending a POST request to the specified URL.
   *
   * @template T The type of entity to create
   * @template R The type of entity returned after creation
   * @param url The API endpoint URL to send the creation request to
   * @param entity The entity data to create
   * @returns A Promise resolving to the created entity of type R
   */
  export const createFn = async <T, R>(url: string, entity: T): Promise<R> => {
    return mutationFn<T, R>("post", url, entity);
  };

  /**
   * Updates an existing entity by sending a PUT request to the specified URL.
   *
   * @template T The type of entity data for the update
   * @template R The type of entity returned after update
   * @param url The API endpoint URL to send the update request to
   * @param entity The updated entity data
   * @returns A Promise resolving to the updated entity of type R
   */
  export const updateFn = async <T, R>(url: string, entity: T): Promise<R> => {
    return mutationFn<T, R>("put", url, entity);
  };

  /**
   * Deletes an entity by sending a PUT request to the specified URL.
   *
   * @template T The type of entity to delete (typically not used in the function body)
   * @template R The type of response returned after deletion
   * @param url The API endpoint URL to send the deletion request to
   * @returns A Promise resolving to the response of type R
   */
  export const deleteFn = async <T, R>(url: string): Promise<R> => {
    return mutationFn<T, R>("delete", url);
  };

  /**
   * A generic hook for fetching lists of entities.
   *
   * @template T The entity type
   * @param url The API endpoint URL
   * @param fetcher Function to fetch the list of entities
   * @param params Additional parameters for the SWR key
   * @param options SWR configuration options
   * @returns Object with the entity list, loading state, error state, and refresh function
   */
  export const useEntityList = <T>(
    url: string,
    fetcher: () => Promise<T[]>,
    params?: any,
    options?: SWRConfiguration
  ) => {
    const { data, error, isLoading, mutate } = useSWR<T[]>(
      params ? [url, params] : url,
      fetcher,
      { revalidateOnMount: true, ...options }
    );

    return {
      entities: Array.isArray(data) ? data : [],
      isLoading,
      isError: error,
      refresh: mutate,
    };
  };

  /**
   * A generic hook for fetching and managing entity data.
   *
   * This hook provides a standardized way to fetch entity data using SWR, with built-in
   * handling for loading states, errors, and data refreshing. It returns the fetched entity
   * or a default value if the data is not yet available.
   *
   * @template T The entity type being fetched
   * @param url The API endpoint URL to fetch data from, or null to disable fetching
   * @param fetcher A function that returns a Promise resolving to the entity data
   * @param defaultValue The default value to use when data is not yet available
   * @param options Additional SWR configuration options to override defaults
   *
   * @returns An object containing:
   *  entity: The fetched data or the default value if data is not available
   *  isLoading: Boolean indicating if the data is currently being fetched
   *  isError: Any error that occurred during fetching, or undefined if successful
   *  refresh: Function to manually trigger a refresh of the data
   *
   * @example
   *
   * // Fetch a user entity
   *
   * const { entity: user, isLoading, isError, refresh } = useEntity<User>(
   *   ${API_URL}/users/${userId},
   *   () => UserAPI.get(userId),
   *   defaultUser()
   * );
   */
  export const useEntity = <T>(
    url: string | null,
    fetcher: () => Promise<T>,
    defaultValue: T,
    options?: SWRConfiguration
  ) => {
    const { data, error, isLoading, mutate } = useSWR<T>(url, fetcher, {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      ...options,
    });

    return {
      entity: data || defaultValue,
      isLoading,
      isError: error,
      refresh: mutate,
    };
  };

  /**
   * A generic hook for entity mutations that manages loading and error states
   * and handles cache invalidation.
   *
   * @template T The entity type
   * @param baseUrl The base URL for the entity API endpoint
   * @param api Object containing CRUD operations for the entity
   * @returns Object with CRUD methods, loading state, and error state
   */
  export const useEntityMutation = <T>(
    baseUrl: string,
    api: {
      create: (entity: T) => Promise<T>;
      update: (id: Id, entity: T) => Promise<T>;
      delete: (id: Id) => Promise<T>;
    }
  ) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const { mutate } = useSWRConfig();

    /**
     * Executes an async operation while managing loading and error states.
     * Also invalidates the entity cache after successful operations.
     *
     * @template R The return type of the operation
     * @param operation A function that returns a Promise
     * @returns A Promise that resolves to the operation result
     * @throws The original error from the operation
     */
    const executeWithState = async <R>(
      operation: () => Promise<R>
    ): Promise<R> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await operation();
        // Refresh entity lists
        mutate((key) => typeof key === "string" && key.includes(baseUrl));
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
       * Creates a new entity.
       *
       * @param entity The entity data to create
       * @returns Promise resolving to the created entity
       */
      create: (entity: T) => executeWithState(() => api.create(entity)),
      /**
       * Updates an existing entity.
       *
       * @param id The ID of the entity to update
       * @param entity The updated entity data
       * @returns Promise resolving to the updated entity
       */
      update: (id: Id, entity: T) =>
        executeWithState(() => api.update(id, entity)),
      /**
       * Deletes an entity.
       *
       * @param id The ID of the entity to delete
       * @returns Promise resolving to the deleted entity
       */
      delete: (id: Id) => executeWithState(() => api.delete(id)),
      /** Indicates if any operation is currently in progress */
      isLoading,
      /** Contains the error if the last operation failed, null otherwise */
      error,
    };
  };
}
