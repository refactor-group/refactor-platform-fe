// Interacts with the users endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { EntityApi } from "./entity-api";
import { User, defaultUser } from "@/types/user";

const USERS_BASEURL: string = `${siteConfig.env.backendServiceURL}/users`;

/**
 * API client for user-related operations.
 */
export const UserApi = {
  /**
   * Fetches a list of users.
   */
  list: async (): Promise<User[]> =>
    EntityApi.listFn<User, User>(USERS_BASEURL, {}),

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
  createNested: async (id: Id, user: User): Promise<User> => {
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
};

/**
 * Hook for fetching a list of users.
 */
export const useUserList = () => {
  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<User>(USERS_BASEURL, () => UserApi.list());

  return {
    users: entities,
    isLoading,
    isError,
    refresh,
  };
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
  return EntityApi.useEntityMutation<User, User>(USERS_BASEURL, {
    create: UserApi.create,
    createNested: UserApi.createNested,
    update: UserApi.update,
    delete: UserApi.delete,
  });
};
