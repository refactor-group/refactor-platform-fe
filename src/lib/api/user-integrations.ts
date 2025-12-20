// Interacts with the user integrations endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { EntityApi } from "./entity-api";
import {
  UserIntegration,
  RecallAiIntegrationUpdate,
  AssemblyAiIntegrationUpdate,
  IntegrationVerifyResponse,
  defaultUserIntegration,
} from "@/types/user-integration";

export const USER_INTEGRATIONS_BASEURL: string = `${siteConfig.env.backendServiceURL}/users`;

/**
 * API client for user integration operations.
 */
export const UserIntegrationApi = {
  /**
   * Fetches integration settings for a user.
   */
  get: async (userId: Id): Promise<UserIntegration> =>
    EntityApi.getFn<UserIntegration>(`${USER_INTEGRATIONS_BASEURL}/${userId}/integrations`),

  /**
   * Updates Recall.ai integration settings.
   */
  updateRecallAi: async (
    userId: Id,
    data: RecallAiIntegrationUpdate
  ): Promise<UserIntegration> =>
    EntityApi.updateFn<RecallAiIntegrationUpdate, UserIntegration>(
      `${USER_INTEGRATIONS_BASEURL}/${userId}/integrations/recall-ai`,
      data
    ),

  /**
   * Updates AssemblyAI integration settings.
   */
  updateAssemblyAi: async (
    userId: Id,
    data: AssemblyAiIntegrationUpdate
  ): Promise<UserIntegration> =>
    EntityApi.updateFn<AssemblyAiIntegrationUpdate, UserIntegration>(
      `${USER_INTEGRATIONS_BASEURL}/${userId}/integrations/assembly-ai`,
      data
    ),

  /**
   * Verifies a provider's API key.
   */
  verifyProvider: async (
    userId: Id,
    provider: "recall-ai" | "assembly-ai"
  ): Promise<IntegrationVerifyResponse> =>
    EntityApi.createFn<null, IntegrationVerifyResponse>(
      `${USER_INTEGRATIONS_BASEURL}/${userId}/integrations/verify/${provider}`,
      null
    ),

  /**
   * Disconnects Google OAuth.
   */
  disconnectGoogle: async (userId: Id): Promise<void> =>
    EntityApi.deleteFn<null, void>(
      `${USER_INTEGRATIONS_BASEURL}/${userId}/integrations/google`
    ),
};

/**
 * Hook for fetching user integration settings.
 */
export const useUserIntegration = (userId: Id) => {
  const url = userId ? `${USER_INTEGRATIONS_BASEURL}/${userId}/integrations` : null;
  const fetcher = () => UserIntegrationApi.get(userId);

  const { entity, isLoading, isError, refresh } = EntityApi.useEntity<UserIntegration>(
    url,
    fetcher,
    defaultUserIntegration()
  );

  return {
    integration: entity,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * Hook for user integration mutations.
 * Provides methods to update integration settings.
 */
export const useUserIntegrationMutation = (userId: Id) => {
  const updateRecallAi = async (data: RecallAiIntegrationUpdate) => {
    return UserIntegrationApi.updateRecallAi(userId, data);
  };

  const updateAssemblyAi = async (data: AssemblyAiIntegrationUpdate) => {
    return UserIntegrationApi.updateAssemblyAi(userId, data);
  };

  const verifyRecallAi = async () => {
    return UserIntegrationApi.verifyProvider(userId, "recall-ai");
  };

  const verifyAssemblyAi = async () => {
    return UserIntegrationApi.verifyProvider(userId, "assembly-ai");
  };

  const disconnectGoogle = async () => {
    return UserIntegrationApi.disconnectGoogle(userId);
  };

  return {
    updateRecallAi,
    updateAssemblyAi,
    verifyRecallAi,
    verifyAssemblyAi,
    disconnectGoogle,
  };
};
