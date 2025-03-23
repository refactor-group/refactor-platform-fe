// Interacts with the organizations/{organizationId}/users endpoints

import { Id } from "@/types/general";
import { EntityApi } from "../entity-api";
import { User } from "@/types/user";
import { ORGANIZATIONS_BASEURL } from "../organizations";

const usersBaseUrl = (organizationId: Id) =>
  `${ORGANIZATIONS_BASEURL}/${organizationId}/users`;

/**
 * API client for user-related operations in the scope of organizations.
 */
export const UserApi = {
  /**
   * Fetches a list of users.
   */
  list: async (organizationId: Id): Promise<User[]> => {
    console.info("Fetching users for organization: " + organizationId);
    return EntityApi.listFn<User, User>(usersBaseUrl(organizationId), {});
  },

  /**
   * Fetches a single user by ID.
   */
  get: async (organizationId: Id, id: Id): Promise<User> =>
    EntityApi.getFn<User>(`${usersBaseUrl(organizationId)}/${id}`),

  /**
   * Creates a new user.
   */
  create: async (user: User): Promise<User> => {
    throw new Error("Create operation not implemented");
  },

  /**
   * Creates a new user nested in an organization.
   */
  createNested: async (organizationId: Id, user: User): Promise<User> =>
    EntityApi.createFn<User, User>(usersBaseUrl(organizationId), user),

  /**
   * Updates an existing user.
   */
  update: async (id: Id, user: User): Promise<User> => {
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
  return EntityApi.useEntityList<User>(
    usersBaseUrl(organizationId),
    () => UserApi.list(organizationId),
    { organizationId }
  );
};

/**
 * Hook for user mutations.
 * Provides methods to create, update, and delete users.
 */
export const useUserMutation = (organizationId: Id) => {
  return EntityApi.useEntityMutation<User>(usersBaseUrl(organizationId), {
    create: UserApi.create,
    createNested: UserApi.createNested,
    update: UserApi.update,
    delete: UserApi.delete,
  });
};
