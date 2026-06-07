import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";

export enum TopicRelevance {
  Neutral = "neutral",
  Background = "background",
  WorthExploring = "worth_exploring",
  Central = "central",
}

export enum TopicImmediacy {
  Neutral = "neutral",
  CanWait = "can_wait",
  Soon = "soon",
  Pressing = "pressing",
}

// This must always reflect the Rust struct on the backend.
// display_order is backend-internal and intentionally absent here.
export interface CoachingSessionTopic {
  id: Id;
  coaching_session_id: Id;
  user_id: Id;
  body: string;
  relevance: TopicRelevance;
  immediacy: TopicImmediacy;
  created_at: DateTime;
  updated_at: DateTime;
}

const toDateTime = (value: unknown): DateTime => {
  if (typeof value === "string") {
    const dt = DateTime.fromISO(value);
    if (dt.isValid) return dt;
  }
  return DateTime.now();
};

const toRelevance = (value: unknown): TopicRelevance =>
  Object.values(TopicRelevance).includes(value as TopicRelevance)
    ? (value as TopicRelevance)
    : TopicRelevance.Neutral;

const toImmediacy = (value: unknown): TopicImmediacy =>
  Object.values(TopicImmediacy).includes(value as TopicImmediacy)
    ? (value as TopicImmediacy)
    : TopicImmediacy.Neutral;

// Build the FE object explicitly from known fields so wire-only fields
// (e.g. display_order) never leak onto the FE type.
export function transformCoachingSessionTopic(data: any): CoachingSessionTopic {
  return {
    id: data.id,
    coaching_session_id: data.coaching_session_id,
    user_id: data.user_id,
    body: data.body,
    relevance: toRelevance(data.relevance),
    immediacy: toImmediacy(data.immediacy),
    created_at: toDateTime(data.created_at),
    updated_at: toDateTime(data.updated_at),
  };
}

export function defaultCoachingSessionTopic(): CoachingSessionTopic {
  const now = DateTime.now();
  return {
    id: "",
    coaching_session_id: "",
    user_id: "",
    body: "",
    relevance: TopicRelevance.Neutral,
    immediacy: TopicImmediacy.Neutral,
    created_at: now,
    updated_at: now,
  };
}
