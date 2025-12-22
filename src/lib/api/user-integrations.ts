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
 * Unified update parameters for user integrations.
 * Backend expects all fields at the same endpoint, each optional.
 */
export interface IntegrationUpdateParams {
  recall_ai_api_key?: string;
  recall_ai_region?: string;
  assembly_ai_api_key?: string;
}

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
   * Updates integration settings (unified endpoint).
   * All fields are optional - only provided fields are updated.
   */
  update: async (
    userId: Id,
    data: IntegrationUpdateParams
  ): Promise<UserIntegration> =>
    EntityApi.updateFn<IntegrationUpdateParams, UserIntegration>(
      `${USER_INTEGRATIONS_BASEURL}/${userId}/integrations`,
      data
    ),

  /**
   * Updates Recall.ai integration settings.
   * Uses the unified update endpoint with Recall.ai fields only.
   */
  updateRecallAi: async (
    userId: Id,
    data: RecallAiIntegrationUpdate
  ): Promise<UserIntegration> =>
    EntityApi.updateFn<IntegrationUpdateParams, UserIntegration>(
      `${USER_INTEGRATIONS_BASEURL}/${userId}/integrations`,
      {
        recall_ai_api_key: data.api_key,
        recall_ai_region: data.region,
      }
    ),

  /**
   * Updates AssemblyAI integration settings.
   * Uses the unified update endpoint with AssemblyAI fields only.
   */
  updateAssemblyAi: async (
    userId: Id,
    data: AssemblyAiIntegrationUpdate
  ): Promise<UserIntegration> =>
    EntityApi.updateFn<IntegrationUpdateParams, UserIntegration>(
      `${USER_INTEGRATIONS_BASEURL}/${userId}/integrations`,
      {
        assembly_ai_api_key: data.api_key,
      }
    ),

  /**
   * Verifies a provider's API key.
   * Sends empty object since the endpoint doesn't require a body.
   */
  verifyProvider: async (
    userId: Id,
    provider: "recall-ai" | "assembly-ai"
  ): Promise<IntegrationVerifyResponse> =>
    EntityApi.createFn<Record<string, never>, IntegrationVerifyResponse>(
      `${USER_INTEGRATIONS_BASEURL}/${userId}/integrations/verify/${provider}`,
      {}
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
