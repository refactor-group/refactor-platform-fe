// Interacts with the organizations/{organizationId}/users endpoints

import { useSWRConfig } from "swr";
import { Id } from "@/types/general";
import { EntityApi } from "../entity-api";
import { User, NewUser, Role } from "@/types/user";
import { ORGANIZATIONS_BASEURL } from "../organizations";

const ORGANIZATIONS_USERS_BASEURL = (organizationId: Id) =>
  `${ORGANIZATIONS_BASEURL}/${organizationId}/users`;

/// `coach_id` is omitted rather than null when no coach is chosen.
type AttachRoleBody = { role: Role; coach_id?: Id };

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
  create: async (_user: NewUser): Promise<User> => {
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
  update: async (_id: Id, _user: NewUser): Promise<User> => {
    throw new Error("Update operation not implemented");
  },

  /**
   * Deletes a user.
   */
  delete: async (_id: Id): Promise<User> => {
    throw new Error("Delete operation not implemented");
  },

  /**
   * Deletes a user nested in an organization.
   */
  deleteNested: async (organizationId: Id, userId: Id): Promise<User> => {
    return EntityApi.deleteFn<null, User>(
      `${ORGANIZATIONS_USERS_BASEURL(organizationId)}/${userId}`
    );
  },

  /**
   * Resends the magic link invitation email to a user whose invite has expired.
   */
  resendInvite: async (organizationId: Id, userId: Id): Promise<void> => {
    await EntityApi.createFn<Record<string, never>, void>(
      `${ORGANIZATIONS_USERS_BASEURL(organizationId)}/${userId}/resend-invite`,
      {}
    );
  },

  /**
   * Grants an existing user membership of this organization with the given role.
   * The account itself is shared, not copied.
   */
  attachExisting: async (
    organizationId: Id,
    userId: Id,
    role: Role,
    coachId?: Id
  ): Promise<User> =>
    EntityApi.createFn<AttachRoleBody, User>(
      `${ORGANIZATIONS_USERS_BASEURL(organizationId)}/${userId}/role`,
      { role, ...(coachId ? { coach_id: coachId } : {}) }
    ),

  /**
   * Removes a user's membership of this organization only. Their account and
   * any other organizations are left untouched.
   */
  removeFromOrganization: async (
    organizationId: Id,
    userId: Id
  ): Promise<void> => {
    await EntityApi.deleteFn<null, void>(
      `${ORGANIZATIONS_USERS_BASEURL(organizationId)}/${userId}/role`
    );
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
 * Provides methods to create, update, and delete users, plus the membership
 * actions (attach an existing user, remove one) that sit outside standard CRUD.
 */
export const useUserMutation = (organizationId: Id) => {
  const { mutate } = useSWRConfig();
  const mutation = EntityApi.useEntityMutation<NewUser, User>(
    ORGANIZATIONS_USERS_BASEURL(organizationId),
    {
      create: UserApi.create,
      createNested: UserApi.createNested,
      update: UserApi.update,
      delete: UserApi.delete,
      deleteNested: UserApi.deleteNested,
    }
  );

  const invalidate = (id: Id) =>
    EntityApi.invalidateEntityCache(mutate, ORGANIZATIONS_USERS_BASEURL(id));

  return {
    ...mutation,
    attachExisting: async (
      orgId: Id,
      userId: Id,
      role: Role,
      coachId?: Id
    ) => {
      const user = await UserApi.attachExisting(orgId, userId, role, coachId);
      invalidate(orgId);
      return user;
    },
    removeFromOrganization: async (orgId: Id, userId: Id) => {
      await UserApi.removeFromOrganization(orgId, userId);
      invalidate(orgId);
    },
  };
};
