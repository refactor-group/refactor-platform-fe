// Interacts with the users endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { EntityApi } from "./entity-api";
import { EntityApiError } from "@/types/entity-api-error";
import {
  User,
  NewUserPassword,
  UserLookupResult,
  defaultUser,
} from "@/types/user";
import { buildQueryString } from "./query-params";
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
export const useUser = (id: Id) => {
  const url = id ? `${USERS_BASEURL}/${id}` : null;
  const fetcher = () => UserApi.get(id);

  const { entity, isLoading, isError, refresh } = EntityApi.useEntity<User>(
    url,
    fetcher,
    defaultUser()
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

/**
 * Errors from the email lookup above (board contract `UserLookupEndpoint` v2).
 *
 * Only the 429 carries an `error` slug on that endpoint; its 400/401/403 are
 * bare strings. So these branch on status, not on the body.
 */

/**
 * Deliberately ours rather than the backend's prose. Theirs, "Too many user
 * lookups. Please wait before trying again.", names neither the cause nor what
 * to do, unlike `last_organization_admin`, which we do render verbatim.
 *
 * States neither the cap (30 per hour, backend-side policy the reader cannot
 * act on) nor a retry time. The window is a rolling count rather than a bucket
 * that empties on the hour, and the backend sends no `Retry-After`, so any
 * duration would be a guess that reads as a promise.
 *
 * "searches" is exact: every authorized lookup counts, including ones that find
 * nobody, which is the common case when recovering several removed members.
 */
export const USER_LOOKUP_RATE_LIMITED_MESSAGE =
  "You've made too many searches. Wait a few minutes and try again.";

/**
 * The lookup throttle, keyed on status alone. Returns the message when the
 * error is one, otherwise null — so callers can write
 * `userLookupRateLimitedMessage(error) ?? fallback`.
 *
 * Matching the status and ignoring the `user_lookup_rate_limited` slug is
 * intentional: the slug adds nothing (the throttle is this endpoint's only 429),
 * and the platform's other 429 — password reset — answers in plain text with no
 * slug at all. Should this one ever follow suit, the message still lands.
 *
 * The limit is per authenticated requester, not per IP, so the copy can blame
 * the reader without being wrong about a colleague's searches.
 */
export const userLookupRateLimitedMessage = (error: unknown): string | null =>
  EntityApiError.isEntityApiError(error) && error.status === 429
    ? USER_LOOKUP_RATE_LIMITED_MESSAGE
    : null;
