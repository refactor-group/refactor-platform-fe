import { Id, EntityApiError } from "@/types/general";
import { useState } from "react";
import useSWR, { KeyedMutator, SWRConfiguration, useSWRConfig } from "swr";
import { sessionGuard } from "@/lib/session/session-guard";
import axios from "axios";

// Re-export EntityApiError for easy access
export { EntityApiError } from "@/types/general";

export namespace EntityApi {
  interface ApiResponse<T> {
    status_code: number;
    data: T;
  }

  /**
   * Interface defining API operations for entity management.
   *
   * @remarks
   * This interface is used to define the available operations for a specific entity type.
   * It includes optional methods for creating, updating, deleting, and nested entity operations.
   *
   * @template T The entity type
   * @template U The entity type returned by the API
   */
  interface ApiOperations<T, U> {
    create?: (entity: T) => Promise<U>;
    createNested?: (id: Id, entity: T) => Promise<U>;
    update?: (id: Id, entity: T) => Promise<U>;
    delete?: (id: Id) => Promise<U>;
    deleteNested?: (entityId: Id, nestedEntityId: Id) => Promise<U>;
  }

  /**
   * Core fetcher function with optional data transformation capability.
   * Handles API requests and response processing with SWR compatibility.
   *
   * @template T The raw data type from the API response
   * @template U The transformed data type (defaults to T if no transform provided)
   * @param url The endpoint URL for the API request
   * @param config Optional request configuration object
   * @param transform Optional transformation function to process the response data
   * @returns Promise resolving to either raw or transformed data of type U
   *
   * @remarks This function:
   * - Implements standard API request handling with axios
   * - Includes default configuration (credentials, timeout, headers)
   * - Supports optional response data transformation
   * - Maintains SWR compatibility for data fetching
   * - Preserves type safety through generic parameters
   *
   * The transformation is applied to the raw data before returning, allowing
   * for data normalization or type conversion workflows.
   */
  const fetcher = async <T, U = T>(
    url: string,
    config: any,
    transform?: (data: T) => U
  ): Promise<U> => {
    try {
      const response = await sessionGuard.get<ApiResponse<T>>(url, {
        ...config,
      });

      const rawData = response.data.data;
      return transform ? transform(rawData) : (rawData as unknown as U);
    } catch (error) {
      // Wrap axios errors in EntityApiError for consistent error handling
      if (axios.isAxiosError(error)) {
        throw new EntityApiError("get", url, error);
      }

      // Re-throw non-axios errors as-is
      throw error;
    }
  };

  /**
   * Type-safe mutation handler for executing CRUD operations via HTTP methods.
   *
   * @template T Type of the request payload data (optional for DELETE)
   * @template R Type of the response data structure
   * @param method HTTP method to execute (POST, PUT, DELETE)
   * @param url API endpoint URL for the operation
   * @param data Optional payload data required for POST/PUT operations
   * @param config Optional post/put/delete configuration object
   * @returns Promise resolving to response data of type R
   * @throws EntityApiError for axios errors, Error for invalid methods or missing required payload data
   *
   * @remarks This function:
   * - Enforces RESTful conventions for mutation operations
   * - Handles payload data type validation through generics
   * - Applies consistent request configuration (credentials, timeout, headers)
   * - Extracts and returns only the data portion from API responses
   * - Throws explicit errors for invalid method/data combinations
   * - Wraps axios errors in EntityApiError for enhanced error handling
   *
   * @usage
   * - POST/PUT: Requires data payload matching type T
   * - DELETE: Executes without payload data
   */
  const mutationFn = async <T, R>(
    method: "post" | "put" | "delete",
    url: string,
    data?: T,
    config?: any
  ): Promise<R> => {
    try {
      let response;
      if (method === "delete") {
        response = await sessionGuard.delete<ApiResponse<R>>(url, { ...config });
      } else if (method === "put" && data) {
        response = await sessionGuard.put<ApiResponse<R>>(url, data, { ...config });
      } else if (data) {
        response = await sessionGuard.post<ApiResponse<R>>(url, data, { ...config });
      } else {
        throw new Error("Invalid method or missing data");
      }

      return response.data.data;
    } catch (error) {
      // Wrap axios errors in EntityApiError for enhanced error handling
      if (axios.isAxiosError(error)) {
        throw new EntityApiError(method, url, error);
      }

      // Re-throw non-axios errors as-is
      throw error;
    }
  };

  /**
   * Generic function to fetch and optionally transform a list of entities from an API endpoint.
   *
   * @template R The raw entity type returned by the API
   * @template U The transformed entity type (defaults to R if no transform provided)
   * @param url The API endpoint URL to fetch data from
   * @param params Optional query parameters to include in the request
   * @param transform Optional transformation function applied to each entity in the response
   * @returns A Promise resolving to an array of entities of type U
   *
   * @remarks This function:
   * - Handles both raw and transformed data workflows
   * - Applies transformations at the array level
   * - Maintains type safety through generic parameters
   * - Delegates actual fetching to the underlying fetcher utility
   */
  export const listFn = async <R, U = R>(
    url: string,
    params: any,
    transform?: (item: R) => U
  ): Promise<U[]> => {
    if (!params) {
      return []; // Return empty array if params are null
    }

    return fetcher<R[], U[]>(
      url,
      params,
      transform ? (data) => data.map(transform) : undefined
    );
  };

  /**
   * Fetches a single entity from the specified URL.
   *
   * @template R The type of entity to be returned
   * @param url The API endpoint URL to fetch data from
   * @returns A Promise resolving to an entity of type R
   */
  export const getFn = async <R>(url: string): Promise<R> => {
    return fetcher<R>(url, {});
  };

  /**
   * Creates a new entity by sending a POST request to the specified URL.
   *
   * @template T The type of entity to create
   * @template R The type of entity returned after creation
   * @param url The API endpoint URL to send the creation request to
   * @param entity The entity data to create
   * @param config Optional http post configuration object
   * @returns A Promise resolving to the created entity of type R
   */
  export const createFn = async <T, R>(
    url: string,
    entity: T,
    config?: any
  ): Promise<R> => {
    return mutationFn<T, R>("post", url, entity, config);
  };

  /**
   * Updates an existing entity by sending a PUT request to the specified URL.
   *
   * @template T The type of entity data for the update
   * @template R The type of entity returned after update
   * @param url The API endpoint URL to send the update request to
   * @param entity The updated entity data
   * @param config Optional http put configuration object
   * @returns A Promise resolving to the updated entity of type R
   */
  export const updateFn = async <T, R>(
    url: string,
    entity: T,
    config?: any
  ): Promise<R> => {
    return mutationFn<T, R>("put", url, entity, config);
  };

  /**
   * Deletes an entity by sending a PUT request to the specified URL.
   *
   * @template T The type of entity to delete (typically not used in the function body)
   * @template R The type of response returned after deletion
   * @param url The API endpoint URL to send the deletion request to
   * @param config Optional http delete configuration object
   * @returns A Promise resolving to the response of type R
   */
  export const deleteFn = async <T, R>(
    url: string,
    config?: any
  ): Promise<R> => {
    return mutationFn<T, R>("delete", url, config);
  };

  /**
   * A generic React hook for fetching lists of entities using SWR.
   *
   * @template T The type of the entity being fetched
   * @param url The API endpoint URL to fetch data from
   * @param fetcher A function that returns a promise resolving to an array of entities
   * @param params Optional parameters to include in the request (used as part of the SWR key)
   * @param options Optional SWR configuration options to customize the fetching behavior
   * @returns An object containing:
   *   - entities: An array of fetched entities (empty array if data is not yet loaded)
   *   - isLoading: A boolean indicating whether the data is currently being fetched
   *   - isError: An error object if the fetch operation failed, undefined otherwise
   *   - refresh: A function to manually trigger a refresh of the data
   */
  export function useEntityList<T>(
    url: string,
    fetcher: () => Promise<T[]>,
    params?: any,
    options?: SWRConfiguration
  ): {
    entities: T[];
    isLoading: boolean;
    isError: any;
    refresh: KeyedMutator<T[]>;
  };

  /**
   * A generic React hook for fetching and transforming lists of entities using SWR.
   *
   * @template T The raw entity type returned by the API
   * @template U The transformed entity type after applying the transformation
   * @param url The API endpoint URL to fetch data from
   * @param fetcher A function that returns a promise resolving to an array of raw entities
   * @param transform A transformation function applied to each entity in the response list
   * @param params Optional parameters to include in the request (used as part of the SWR key)
   * @param options Optional SWR configuration options to customize fetching behavior
   * @returns An object containing:
   *   - entities: An array of transformed entities (empty array if data not loaded)
   *   - isLoading: Boolean indicating if the data is currently being fetched
   *   - isError: Error object if fetch failed, undefined otherwise
   *   - refresh: Function to manually trigger refresh of transformed data
   *
   * @remarks This overload handles entity transformation workflows where each raw entity
   * of type T is converted to type U through the provided transform function.
   */
  export function useEntityList<T, U>(
    url: string,
    fetcher: () => Promise<T[]>,
    transform: (item: T) => U,
    params?: any,
    options?: SWRConfiguration
  ): {
    entities: U[];
    isLoading: boolean;
    isError: any;
    refresh: KeyedMutator<U[]>;
  };

  /**
   * Implementation of an overloaded entity fetching hook with optional transformation.
   * Handles both transformed and non-transformed data fetching workflows through parameter polymorphism.
   *
   * @template T The raw entity type from API response
   * @template U The transformed entity type (defaults to T if no transformer provided)
   * @param url API endpoint URL for resource location
   * @param fetcher Data fetching function returning raw entity arrays
   * @param transformOrParams Either a transformation function or request parameters
   * @param paramsOrOptions Either request parameters or SWR configuration options
   * @param options SWR configuration options when using transformation
   * @returns Object containing transformed entities, loading state, error state, and refresh capability
   *
   * @remarks The parameter order and types enable multiple calling signatures:
   * - Without transformation: (url, fetcher, params?, options?)
   * - With transformation: (url, fetcher, transform, params?, options?)
   *
   * The implementation dynamically detects parameter types to maintain backward compatibility
   * while supporting new transformation capabilities through method overloading.
   */
  export function useEntityList<T, U = T>(
    url: string,
    fetcher: () => Promise<T[]>,
    params?: any,
    options?: SWRConfiguration
  ) {
    const isTransform = typeof params === "function";
    const transform = isTransform ? params : undefined;
    const actualParams = isTransform ? options : params;
    const swrOptions = isTransform ? undefined : options;

    // Use SWR's conditional fetching via key nullification
    const key = actualParams ? [url, actualParams] : null;

    const { data, error, isLoading, mutate } = useSWR<T[]>(key, fetcher, {
      revalidateOnMount: true,
      ...swrOptions,
    });

    const entities = data
      ? transform
        ? data.map(transform)
        : (data as unknown as U[])
      : [];

    return {
      entities,
      isLoading,
      isError: error,
      refresh: mutate as unknown as KeyedMutator<U[]>,
    };
  }

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
   * @template U The entity type returned by the API
   * @param baseUrl The base URL for the entity API endpoint
   * @param api Object containing CRUD operations for the entity
   * @returns Object with CRUD methods, loading state, and error state
   */
  export const useEntityMutation = <T, U = T>(
    baseUrl: string,
    api: ApiOperations<T, U>
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
        // Handle both EntityApiError and regular Error types
        const error =
          err instanceof Error ? err : new Error("Unknown error occurred");
        setError(error);
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

      create: (entity: T) => executeWithState(() => api.create!(entity)),
      /**
       * Creates a new entity nested under another entity (foreign key relationship).
       *
       * @param id The entity's id under which to create entity
       * @param entity The entity data to create
       * @returns Promise resolving to the created entity
       */
      createNested: (id: Id, entity: T) =>
        executeWithState(() => api.createNested!(id, entity)),
      /**
       * Updates an existing entity.
       *
       * @param id The ID of the entity to update
       * @param entity The updated entity data
       * @returns Promise resolving to the updated entity
       */
      update: (id: Id, entity: T) =>
        executeWithState(() => api.update!(id, entity)),
      /**
       * Deletes an entity.
       *
       * @param id The ID of the entity to delete
       * @returns Promise resolving to the deleted entity
       */
      delete: (id: Id) => executeWithState(() => api.delete!(id)),

      /**
       * Deletes an entity nested under another entity (foreign key relationship).
       *
       * @param entityId The entity's id under which to delete entity
       * @param nestedEntityId The nested entity's id to delete
       * @returns Promise resolving to the deleted entity
       */
      deleteNested: (entityId: Id, nestedEntityId: Id) =>
        executeWithState(() => api.deleteNested!(entityId, nestedEntityId)),

      /** Indicates if any operation is currently in progress */
      isLoading,
      /** Contains the error if the last operation failed, null otherwise */
      error,
    };
  };

  /**
   * Hook to clear the entire SWR cache.
   * Useful for clearing stale data when switching users or on logout.
   */
  export const useClearCache = () => {
    const { cache } = useSWRConfig();

    return () => {
      console.trace("🧹 CACHE-CLEAR: Starting full SWR cache clear");
      console.trace(
        "🧹 CACHE-CLEAR: Cache keys before clear:",
        Array.from(cache.keys())
      );

      // Clear all SWR cached data using the official API
      for (const key of cache.keys()) {
        cache.delete(key);
      }

      console.trace(
        "🧹 CACHE-CLEAR: Cache cleared, remaining keys:",
        Array.from(cache.keys())
      );
    };
  };
}
