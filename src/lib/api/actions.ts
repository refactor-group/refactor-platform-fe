// Interacts with the action endpoints for CRUD operations
// Note: For fetching lists of actions, use user-actions.ts instead

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { Action, defaultAction } from "@/types/action";
import { EntityApi } from "./entity-api";

const ACTIONS_BASEURL: string = `${siteConfig.env.backendServiceURL}/actions`;

/**
 * API client for action CRUD operations.
 *
 * This object provides functions for creating, reading, updating, and deleting actions.
 * For fetching lists of actions, use UserActionsApi from user-actions.ts instead.
 */
export const ActionApi = {
  /**
   * Fetches a single action by its ID.
   *
   * @param id The ID of the action to retrieve
   * @returns Promise resolving to the Action object
   */
  get: async (id: Id): Promise<Action> =>
    EntityApi.getFn<Action>(`${ACTIONS_BASEURL}/${id}`),

  /**
   * Creates a new action.
   *
   * @param action The action data to create
   * @returns Promise resolving to the created Action object
   */
  create: async (action: Action): Promise<Action> =>
    EntityApi.createFn<Action, Action>(ACTIONS_BASEURL, action),

  createNested: async (_id: Id, _entity: Action): Promise<Action> => {
    throw new Error("Create nested operation not implemented");
  },

  /**
   * Updates an existing action.
   *
   * @param id The ID of the action to update
   * @param action The updated action data
   * @returns Promise resolving to the updated Action object
   */
  update: async (id: Id, action: Action): Promise<Action> =>
    EntityApi.updateFn<Action, Action>(`${ACTIONS_BASEURL}/${id}`, action),

  /**
   * Deletes an action.
   *
   * @param id The ID of the action to delete
   * @returns Promise resolving to the deleted Action object
   */
  delete: async (id: Id): Promise<Action> =>
    EntityApi.deleteFn<null, Action>(`${ACTIONS_BASEURL}/${id}`),

  /**
   * Deletes an action nested under another entity (foreign key relationship).
   *
   * @param entityId The ID of the entity under which to delete the action
   * @param actionId The ID of the action to delete
   * @returns Promise resolving to the deleted Action object
   */
  deleteNested: async (_entityId: Id, _actionId: Id): Promise<Action> => {
    throw new Error("Delete nested operation not implemented");
  },
};

/**
 * A custom React hook that fetches a single action by its ID.
 * This hook uses SWR to efficiently fetch and cache action data.
 * It does not automatically revalidate the data on window focus, reconnect, or when data becomes stale.
 *
 * @param id The ID of the action to fetch. If null or undefined, no fetch will occur.
 * @returns An object containing:
 *
 * * action: The fetched Action object, or a default action if not yet loaded
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useAction = (id: Id) => {
  const url = id ? `${ACTIONS_BASEURL}/${id}` : null;
  const fetcher = () => ActionApi.get(id);

  const { entity, isLoading, isError, refresh } = EntityApi.useEntity<Action>(
    url,
    fetcher,
    defaultAction()
  );

  return {
    action: entity,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * A custom React hook that provides mutation operations for actions with loading and error state management.
 * This hook simplifies creating, updating, and deleting actions while handling loading states,
 * error management, and cache invalidation automatically.
 *
 * @returns An object containing:
 * create: Function to create a new action
 * update: Function to update an existing action
 * delete: Function to delete an action
 * isLoading: Boolean indicating if any operation is in progress
 * error: Error object if the last operation failed, null otherwise
 */
export const useActionMutation = () => {
  return EntityApi.useEntityMutation<Action>(ACTIONS_BASEURL, {
    create: ActionApi.create,
    createNested: ActionApi.createNested,
    update: ActionApi.update,
    delete: ActionApi.delete,
    deleteNested: ActionApi.deleteNested,
  });
};
