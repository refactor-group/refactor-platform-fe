// Interacts with the users endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { EntityApi } from "./entity-api";
import {
  User,
  NewUserPassword,
  UserLookupResult,
  defaultUser,
} from "@/types/user";
import { buildQueryString } from "./query-params";
import type { SWRConfiguration } from "swr";
import { type Option, Some, None } from "@/types/option";

export const USERS_BASEURL: string = `${siteConfig.env.backendServiceURL}/users`;

/**
 * API client for user-related operations.
 */
export const UserApi = {
  /**
   * Looks up a single user by exact (case-insensitive) email address.
   *
   * @param email The email address to look for
   * @returns The matching user, or null when there is no match or the caller
   *   may not see them. The backend makes those two cases indistinguishable so
   *   the endpoint can't be used to enumerate accounts.
   */
  lookupByEmail: async (email: string): Promise<Option<UserLookupResult>> => {
    const results = await EntityApi.getFn<UserLookupResult[]>(
      `${USERS_BASEURL}${buildQueryString({ email })}`
    );
    return results.length > 0 ? Some(results[0]) : None;
  },

  /**
   * Fetches a single user by ID.
   */
  get: async (id: Id): Promise<User> =>
    EntityApi.getFn<User>(`${USERS_BASEURL}/${id}`),

  /**
   * Creates a new user.
   */
  create: async (user: User): Promise<User> =>
    EntityApi.createFn<User, User>(USERS_BASEURL, user),

  /**
   * Creates a new user nested under an organization.
   */
  createNested: async (_id: Id, _user: User): Promise<User> => {
    throw new Error("Create nested operation not implemented");
  },

  /**
   * Updates an existing user.
   */
  update: async (id: Id, user: User): Promise<User> =>
    EntityApi.updateFn<User, User>(`${USERS_BASEURL}/${id}`, user),

  /**
   * Deletes a user.
   */
  delete: async (id: Id): Promise<User> =>
    EntityApi.deleteFn<null, User>(`${USERS_BASEURL}/${id}`),

  /**
   * Deletes a user nested under another entity (foreign key relationship).
   *
   * @param entityId The ID of the entity under which to delete the user
   * @param userId The ID of the user to delete
   * @returns Promise resolving to the deleted User object
   */
  deleteNested: async (_entityId: Id, _userId: Id): Promise<User> => {
    throw new Error("Delete nested operation not implemented");
  },
};

/**
 * Hook for fetching a single user.
 */
export const useUser = (id: Id, options?: SWRConfiguration) => {
  const url = id ? `${USERS_BASEURL}/${id}` : null;
  const fetcher = () => UserApi.get(id);

  const { entity, isLoading, isError, refresh } = EntityApi.useEntity<User>(
    url,
    fetcher,
    defaultUser(),
    options
  );

  return {
    user: entity,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * Hook for user mutations.
 * Provides methods to create, update, and delete users.
 */
export const useUserMutation = () => {
  return EntityApi.useEntityMutation<User>(USERS_BASEURL, {
    create: UserApi.create,
    createNested: UserApi.createNested,
    update: UserApi.update,
    delete: UserApi.delete,
    deleteNested: UserApi.deleteNested,
  });
};

/**
 * Hook for user password mutations.
 * Provides methods to update user password.
 */
export const useUserPasswordMutation = () => {
  return EntityApi.useEntityMutation<NewUserPassword, User>(USERS_BASEURL, {
    update: async (id: Id, data: NewUserPassword): Promise<User> =>
      EntityApi.updateFn<NewUserPassword, User>(`${USERS_BASEURL}/${id}/password`, data),
  });
};
