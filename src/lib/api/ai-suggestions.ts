// Interacts with the AI suggestions endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { EntityApi } from "./entity-api";
import { AiSuggestedItem } from "@/types/meeting-recording";

export const COACHING_SESSIONS_BASEURL: string = `${siteConfig.env.backendServiceURL}/coaching_sessions`;
export const AI_SUGGESTIONS_BASEURL: string = `${siteConfig.env.backendServiceURL}/ai-suggestions`;

/**
 * Response from accepting a suggestion.
 */
export interface AcceptSuggestionResponse {
  suggestion: AiSuggestedItem;
  entity_id: Id;
  entity_type: "action" | "agreement";
}

/**
 * API client for AI suggestion operations.
 */
export const AiSuggestionApi = {
  /**
   * Fetches pending AI suggestions for a coaching session.
   */
  getBySession: async (sessionId: Id): Promise<AiSuggestedItem[]> => {
    try {
      return await EntityApi.getFn<AiSuggestedItem[]>(
        `${COACHING_SESSIONS_BASEURL}/${sessionId}/ai-suggestions`
      );
    } catch {
      // Return empty array if no suggestions exist
      return [];
    }
  },

  /**
   * Accepts an AI suggestion and creates the corresponding entity.
   */
  accept: async (suggestionId: Id): Promise<AcceptSuggestionResponse> =>
    EntityApi.createFn<null, AcceptSuggestionResponse>(
      `${AI_SUGGESTIONS_BASEURL}/${suggestionId}/accept`,
      null
    ),

  /**
   * Dismisses an AI suggestion.
   */
  dismiss: async (suggestionId: Id): Promise<AiSuggestedItem> =>
    EntityApi.createFn<null, AiSuggestedItem>(
      `${AI_SUGGESTIONS_BASEURL}/${suggestionId}/dismiss`,
      null
    ),
};

/**
 * Hook for fetching AI suggestions for a session.
 */
export const useAiSuggestions = (sessionId: Id) => {
  const url = sessionId
    ? `${COACHING_SESSIONS_BASEURL}/${sessionId}/ai-suggestions`
    : null;
  const fetcher = () => AiSuggestionApi.getBySession(sessionId);

  const { entity, isLoading, isError, refresh } = EntityApi.useEntity<
    AiSuggestedItem[]
  >(url, fetcher, [], {
    refreshInterval: 5000, // Poll every 5 seconds for new suggestions
    revalidateOnFocus: true,
  });

  return {
    suggestions: entity,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * Hook for AI suggestion mutations (accept/dismiss).
 */
export const useAiSuggestionMutation = () => {
  const accept = async (
    suggestionId: Id
  ): Promise<AcceptSuggestionResponse> => {
    return AiSuggestionApi.accept(suggestionId);
  };

  const dismiss = async (suggestionId: Id): Promise<AiSuggestedItem> => {
    return AiSuggestionApi.dismiss(suggestionId);
  };

  return {
    accept,
    dismiss,
  };
};
