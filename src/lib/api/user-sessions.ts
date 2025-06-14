// Interacts with the user_session endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { UserSession } from "@/types/user-session";
import { EntityApi } from "./entity-api";

const USER_SESSIONS_BASEURL: string = `${siteConfig.env.backendServiceURL}/user_sessions`;
const USER_SESSIONS_LOGINURL: string = `${siteConfig.env.backendServiceURL}/login`;
// const USER_SESSIONS_LOGINURL: string = `https://refactor.engineer/api/login`;
const USER_SESSIONS_LOGOUTURL: string = `${siteConfig.env.backendServiceURL}/delete`;

/**
 * API client for user session-related operations.
 *
 * This object provides a collection of functions for interacting with the user session endpoints
 * on the backend service. It handles the HTTP requests and response parsing for all CRUD operations.
 */
export const UserSessionApi = {
  /**
   * Unimplemented
   */
  list: async (): Promise<UserSession[]> => {
    throw new Error("List operation not implemented");
  },

  /**
   * Unimplemented
   */
  get: async (): Promise<UserSession> => {
    throw new Error("Get operation not implemented");
  },

  /**
   * Creates a new user session.
   *
   * This logs a user in of the system by creating a new active cookie session.
   *
   * @param user_session session The user session data to create
   * @returns Promise resolving to the created UserSession object
   */
  create: async (user_session: UserSession): Promise<UserSession> => {
    const config = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };
    // TODO: remove this before final commit!
    console.debug(`USER_SESSIONS_LOGINURL: ${USER_SESSIONS_LOGINURL}`);
    return EntityApi.createFn<UserSession, UserSession>(
      USER_SESSIONS_LOGINURL,
      user_session,
      config
    );
  },

  /**
   * Unimplemented
   */
  createNested: async (): Promise<UserSession> => {
    throw new Error("Create nested operation not implemented");
  },

  /**
   * Unimplemented
   */
  update: async (): Promise<UserSession> => {
    throw new Error("Update operation not implemented");
  },

  /**
   * Deletes a user session.
   *
   * This logs a user out of the system by deleting the active cookie session.
   *
   * @returns Promise resolving to the deleted UserSession object
   */
  delete: async (_id: Id): Promise<UserSession> =>
    // TODO we are not using the id here as the backend extracts the user's ID from the session cookie
    // at some point it may make sense to decouple user session related network operations from
    // entity related network operations.
    EntityApi.deleteFn<null, UserSession>(`${USER_SESSIONS_LOGOUTURL}`),

  /**
   * Deletes a user session nested under another entity (foreign key relationship).
   *
   * @param entityId The ID of the entity under which to delete the user session
   * @param userSessionId The ID of the user session to delete
   * @returns Promise resolving to the deleted UserSession object
   */
  deleteNested: async (
    _entityId: Id,
    _userSessionId: Id
  ): Promise<UserSession> => {
    throw new Error("Delete nested operation not implemented");
  },
};

/**
 * A custom React hook that provides mutation operations for user sessions with loading and error state management.
 * This hook simplifies creating, updating, and deleting user sessions while handling loading states,
 * error management, and cache invalidation automatically.
 *
 * @returns An object containing:
 * create: Function to create a new user session
 * update: Function to update an existing user session
 * delete: Function to delete an user session
 * isLoading: Boolean indicating if any operation is in progress
 * error: Error object if the last operation failed, null otherwise
 */
export const useUserSessionMutation = () => {
  return EntityApi.useEntityMutation<UserSession>(USER_SESSIONS_BASEURL, {
    create: UserSessionApi.create,
    createNested: UserSessionApi.createNested,
    update: UserSessionApi.update,
    delete: UserSessionApi.delete,
    deleteNested: UserSessionApi.deleteNested,
  });
};
