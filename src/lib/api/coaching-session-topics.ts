// Interacts with the coaching session topics endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import {
  CoachingSessionTopic,
  TopicPriority,
  TopicStatus,
  transformCoachingSessionTopic,
} from "@/types/coaching-session-topic";
import { sessionGuard } from "@/lib/auth/session-guard";
import { EntityApi, ApiResponse } from "./entity-api";

const COACHING_SESSIONS_BASEURL: string = `${siteConfig.env.backendServiceURL}/coaching_sessions`;

const topicsUrl = (coachingSessionId: Id): string =>
  `${COACHING_SESSIONS_BASEURL}/${coachingSessionId}/topics`;

// PUT body is body-only; priority goes through the dedicated rating sub-route,
// status through the dedicated status sub-route.
interface UpdateTopicFields {
  body: string;
}

// Coachee-only. Send `priority` to set; `null` to clear; omit for a no-op.
interface RateTopicFields {
  priority?: TopicPriority | null;
}

// POST body: `body` required; `priority` optional so an undo can recreate a
// deleted topic with its priority intact. Omitting it leaves the topic unset.
interface CreateTopicBody {
  body: string;
  priority?: TopicPriority;
}

/**
 * API client for coaching session topic operations.
 *
 * Topics are nested under a coaching session and arrive server-ordered;
 * never re-sort them client-side.
 */
export const CoachingSessionTopicApi = {
  list: async (coachingSessionId: Id): Promise<CoachingSessionTopic[]> =>
    (
      await EntityApi.listNestedFn<CoachingSessionTopic>(
        COACHING_SESSIONS_BASEURL,
        coachingSessionId,
        "topics",
        {}
      )
    ).map(transformCoachingSessionTopic),

  // `priority` is optional; supply it to recreate a topic with its priority
  // preserved (undo of a delete).
  create: async (
    coachingSessionId: Id,
    body: string,
    priority?: TopicPriority
  ): Promise<CoachingSessionTopic> =>
    transformCoachingSessionTopic(
      await EntityApi.createFn<CreateTopicBody, CoachingSessionTopic>(
        topicsUrl(coachingSessionId),
        priority ? { body, priority } : { body }
      )
    ),

  // PUT carries only the body; rating is a separate route (see `rate`).
  update: async (
    coachingSessionId: Id,
    topicId: Id,
    fields: UpdateTopicFields
  ): Promise<CoachingSessionTopic> =>
    transformCoachingSessionTopic(
      await EntityApi.updateFn<UpdateTopicFields, CoachingSessionTopic>(
        `${topicsUrl(coachingSessionId)}/${topicId}`,
        fields
      )
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
  // Whole-list reorder: the FE sends the full ordered id list (`ordered_ids`),
  // never display_order. A non-permutation is rejected 422.
  reorder: async (
    coachingSessionId: Id,
    orderedTopicIds: Id[]
  ): Promise<CoachingSessionTopic[]> => {
    const res = await sessionGuard.patch<ApiResponse<any[]>>(
      `${topicsUrl(coachingSessionId)}/reorder`,
      { ordered_ids: orderedTopicIds }
    );
    return res.data.data.map(transformCoachingSessionTopic);
  },

  // Coachee-only priority (BE-enforced; coach write → 403). Dedicated sub-route;
  // `priority: null` clears, omitting it is a no-op.
  rate: async (
    coachingSessionId: Id,
    topicId: Id,
    fields: RateTopicFields
  ): Promise<CoachingSessionTopic> => {
    const res = await sessionGuard.patch<ApiResponse<any>>(
      `${topicsUrl(coachingSessionId)}/${topicId}/rating`,
      fields
    );
    return transformCoachingSessionTopic(res.data.data);
  },

  // Lifecycle write (Open/Discussed/Deferred). Either participant may set it.
  // Setting Deferred re-parents the topic into the next session (or holds it
  // when none exists yet). The response is the topic at its NEW location, so
  // read `coaching_session_id` to learn where it landed.
  setStatus: async (
    coachingSessionId: Id,
    topicId: Id,
    status: TopicStatus
  ): Promise<CoachingSessionTopic> => {
    const res = await sessionGuard.patch<ApiResponse<any>>(
      `${topicsUrl(coachingSessionId)}/${topicId}/status`,
      { status }
    );
    return transformCoachingSessionTopic(res.data.data);
  },

  // Unified undo (either participant; author-only when undoing a delete).
  // State-derived: reverses whatever undoable op last happened to the topic —
  // a defer/move (returns it to origin, status restored) OR a delete (faithful
  // soft-delete restore: same id/status/priority/position). 422 if nothing to
  // undo. Address it at the topic's CURRENT session. No body.
  undo: async (
    coachingSessionId: Id,
    topicId: Id
  ): Promise<CoachingSessionTopic> => {
    const res = await sessionGuard.post<ApiResponse<any>>(
      `${topicsUrl(coachingSessionId)}/${topicId}/undo`
    );
    return transformCoachingSessionTopic(res.data.data);
  },
};

/**
 * Fetches topics for a coaching session. Keyed on the session-scoped topics
 * URL so topic mutations (which invalidate by URL substring) revalidate it.
 *
 * The fetcher already transforms, so the SWR cache holds wire-normalized
 * `CoachingSessionTopic`s and `topics` keeps a stable reference between renders
 * — letting optimistic writes splice the cache in place (no refetch, no flash).
 */
export const useCoachingSessionTopicList = (coachingSessionId: Id) => {
  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<CoachingSessionTopic>(
      topicsUrl(coachingSessionId),
      () => CoachingSessionTopicApi.list(coachingSessionId),
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
 * mutations invalidate the topic list) and adds reorder + rate alongside.
 */
export const useCoachingSessionTopicMutation = (coachingSessionId: Id) => {
  const mutation = EntityApi.useEntityMutation<
    UpdateTopicFields,
    CoachingSessionTopic
  >(topicsUrl(coachingSessionId), {
    create: (fields) =>
      CoachingSessionTopicApi.create(coachingSessionId, fields.body),
    update: (topicId, fields) =>
      CoachingSessionTopicApi.update(coachingSessionId, topicId, fields),
    delete: (topicId) =>
      CoachingSessionTopicApi.delete(coachingSessionId, topicId),
  });

  return {
    create: (body: string) => mutation.create({ body }),
    update: (topicId: Id, fields: UpdateTopicFields) =>
      mutation.update(topicId, fields),
    delete: (topicId: Id) => mutation.delete(topicId),
    reorder: (orderedIds: Id[]) =>
      CoachingSessionTopicApi.reorder(coachingSessionId, orderedIds),
    rate: (topicId: Id, fields: RateTopicFields) =>
      CoachingSessionTopicApi.rate(coachingSessionId, topicId, fields),
    setStatus: (topicId: Id, status: TopicStatus) =>
      CoachingSessionTopicApi.setStatus(coachingSessionId, topicId, status),
    // Address undo at the topic's CURRENT session — after a move that's the
    // destination (not this hook's bound session), so it takes an explicit id.
    // Faithfully reverses a defer OR a delete; the server derives which.
    undo: (sessionId: Id, topicId: Id) =>
      CoachingSessionTopicApi.undo(sessionId, topicId),
    isLoading: mutation.isLoading,
    error: mutation.error,
  };
};
