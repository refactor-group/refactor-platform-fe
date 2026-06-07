// Interacts with the coaching session topics endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import {
  CoachingSessionTopic,
  TopicRelevance,
  TopicImmediacy,
  transformCoachingSessionTopic,
} from "@/types/coaching-session-topic";
import { sessionGuard } from "@/lib/auth/session-guard";
import { EntityApi, ApiResponse } from "./entity-api";

const COACHING_SESSIONS_BASEURL: string = `${siteConfig.env.backendServiceURL}/coaching_sessions`;

const topicsUrl = (coachingSessionId: Id): string =>
  `${COACHING_SESSIONS_BASEURL}/${coachingSessionId}/topics`;

interface CoachingSessionTopicFields {
  body?: string;
  relevance?: TopicRelevance;
  immediacy?: TopicImmediacy;
}

/**
 * API client for coaching session topic operations.
 *
 * Topics are nested under a coaching session and arrive server-ordered;
 * never re-sort them client-side.
 */
export const CoachingSessionTopicApi = {
  list: async (coachingSessionId: Id): Promise<CoachingSessionTopic[]> =>
    EntityApi.listNestedFn<CoachingSessionTopic>(
      COACHING_SESSIONS_BASEURL,
      coachingSessionId,
      "topics",
      {}
    ),

  create: async (
    coachingSessionId: Id,
    body: string
  ): Promise<CoachingSessionTopic> =>
    transformCoachingSessionTopic(
      await EntityApi.createFn<{ body: string }, CoachingSessionTopic>(
        topicsUrl(coachingSessionId),
        { body }
      )
    ),

  update: async (
    coachingSessionId: Id,
    topicId: Id,
    fields: CoachingSessionTopicFields
  ): Promise<CoachingSessionTopic> =>
    transformCoachingSessionTopic(
      await EntityApi.updateFn<
        CoachingSessionTopicFields,
        CoachingSessionTopic
      >(`${topicsUrl(coachingSessionId)}/${topicId}`, fields)
    ),

  delete: async (
    coachingSessionId: Id,
    topicId: Id
  ): Promise<CoachingSessionTopic> =>
    transformCoachingSessionTopic(
      await EntityApi.deleteFn<null, CoachingSessionTopic>(
        `${topicsUrl(coachingSessionId)}/${topicId}`
      )
    ),

  // EntityApi has no PATCH helper; call sessionGuard.patch directly.
  // Whole-list reorder: the FE sends the full ordered id list, never display_order.
  reorder: async (
    coachingSessionId: Id,
    orderedTopicIds: Id[]
  ): Promise<CoachingSessionTopic[]> => {
    const res = await sessionGuard.patch<ApiResponse<any[]>>(
      `${topicsUrl(coachingSessionId)}/reorder`,
      { topic_ids: orderedTopicIds }
    );
    return res.data.data.map(transformCoachingSessionTopic);
  },
};

/**
 * Fetches topics for a coaching session. Keyed on the session-scoped topics
 * URL so topic mutations (which invalidate by URL substring) revalidate it.
 */
export const useCoachingSessionTopicList = (coachingSessionId: Id) => {
  const { entities, isLoading, isError, refresh } = EntityApi.useEntityList<
    CoachingSessionTopic,
    CoachingSessionTopic
  >(
    topicsUrl(coachingSessionId),
    () => CoachingSessionTopicApi.list(coachingSessionId),
    transformCoachingSessionTopic,
    coachingSessionId
  );

  return {
    topics: entities,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * Mutation operations for a coaching session's topics, scoped to one session.
 * Composes useEntityMutation (keyed on the topics URL so its successful
 * mutations invalidate the topic list) and adds reorder alongside.
 */
export const useCoachingSessionTopicMutation = (coachingSessionId: Id) => {
  const mutation = EntityApi.useEntityMutation<
    CoachingSessionTopicFields,
    CoachingSessionTopic
  >(topicsUrl(coachingSessionId), {
    create: (fields) =>
      CoachingSessionTopicApi.create(coachingSessionId, fields.body ?? ""),
    update: (topicId, fields) =>
      CoachingSessionTopicApi.update(coachingSessionId, topicId, fields),
    delete: (topicId) =>
      CoachingSessionTopicApi.delete(coachingSessionId, topicId),
  });

  return {
    create: (body: string) => mutation.create({ body }),
    update: (topicId: Id, fields: CoachingSessionTopicFields) =>
      mutation.update(topicId, fields),
    delete: (topicId: Id) => mutation.delete(topicId),
    reorder: (orderedIds: Id[]) =>
      CoachingSessionTopicApi.reorder(coachingSessionId, orderedIds),
    isLoading: mutation.isLoading,
    error: mutation.error,
  };
};
