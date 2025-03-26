// Interacts with the organizations/{organizationId}/users endpoints

import { Id } from "@/types/general";
import { EntityApi } from "../entity-api";
import { User, NewUser } from "@/types/user";
import { ORGANIZATIONS_BASEURL } from "../organizations";

const ORGANIZATIONS_USERS_BASEURL = (organizationId: Id) =>
  `${ORGANIZATIONS_BASEURL}/${organizationId}/users`;

/**
 * API client for user-related operations in the scope of organizations.
 */
export const UserApi = {
  /**
   * Fetches a list of users.
   */
  list: async (organizationId: Id): Promise<User[]> =>
    EntityApi.listFn<User, User>(
      ORGANIZATIONS_USERS_BASEURL(organizationId),
      {}
    ),

  /**
   * Fetches a single user by ID.
   */
  get: async (organizationId: Id, id: Id): Promise<User> =>
    EntityApi.getFn<User>(
      `${ORGANIZATIONS_USERS_BASEURL(organizationId)}/${id}`
    ),

  /**
   * Creates a new user.
   */
  create: async (user: NewUser): Promise<User> => {
    throw new Error("Create operation not implemented");
  },

  /**
   * Creates a new user nested in an organization.
   */
  createNested: async (organizationId: Id, user: NewUser): Promise<User> => {
    return EntityApi.createFn<NewUser, User>(
      ORGANIZATIONS_USERS_BASEURL(organizationId),
      user
    );
  },

  /**
   * Updates an existing user.
   */
  update: async (id: Id, user: NewUser): Promise<User> => {
    throw new Error("Update operation not implemented");
  },

  /**
   * Deletes a user.
   */
  delete: async (id: Id): Promise<User> => {
    throw new Error("Delete operation not implemented");
  },
};

/**
 * Hook for fetching a list of users.
 */
export const useUserList = (organizationId: Id) => {
  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<User>(
      ORGANIZATIONS_USERS_BASEURL(organizationId),
      () => UserApi.list(organizationId),
      { organizationId }
    );

  return {
    users: entities,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * Hook for user mutations.
 * Provides methods to create, update, and delete users.
 */
export const useUserMutation = (organizationId: Id) => {
  return EntityApi.useEntityMutation<NewUser, User>(
    ORGANIZATIONS_USERS_BASEURL(organizationId),
    {
      create: UserApi.create,
      createNested: UserApi.createNested,
      update: UserApi.update,
      delete: UserApi.delete,
    }
  );
};
