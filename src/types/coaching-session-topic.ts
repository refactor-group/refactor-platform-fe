import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";
import { type Option, Some, None } from "@/types/option";

// Wire values are PascalCase to match Rust serde (same convention as goal
// `status`).
export enum TopicPriority {
  Low = "Low",
  Medium = "Medium",
  High = "High",
}

export enum TopicStatus {
  Open = "Open",
  Discussed = "Discussed",
  Deferred = "Deferred",
}

// This must always reflect the Rust struct on the backend.
// display_order is backend-internal and intentionally absent here.
export interface CoachingSessionTopic {
  id: Id;
  coaching_session_id: Id;
  user_id: Id;
  body: string;
  // Coachee-set; None = unset (no forced rating).
  priority: Option<TopicPriority>;
  // Always present; lifecycle defaults to Open. Deferred only persists while
  // the topic is held (no next session to move into yet).
  status: TopicStatus;
  // The session this topic was last moved OUT of (deferral re-parents it).
  // Some after a move; cleared on undo. Powers the "moved from" badge + undo.
  moved_from_session_id: Option<Id>;
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

const toPriority = (value: unknown): Option<TopicPriority> =>
  Object.values(TopicPriority).includes(value as TopicPriority)
    ? Some(value as TopicPriority)
    : None;

const toStatus = (value: unknown): TopicStatus =>
  Object.values(TopicStatus).includes(value as TopicStatus)
    ? (value as TopicStatus)
    : TopicStatus.Open;

const toOptionalId = (value: unknown): Option<Id> =>
  typeof value === "string" && value.length > 0 ? Some(value) : None;

// Build the FE object explicitly from known fields so wire-only fields
// (e.g. display_order) never leak onto the FE type.
export function transformCoachingSessionTopic(data: any): CoachingSessionTopic {
  return {
    id: data.id,
    coaching_session_id: data.coaching_session_id,
    user_id: data.user_id,
    body: data.body,
    priority: toPriority(data.priority),
    status: toStatus(data.status),
    moved_from_session_id: toOptionalId(data.moved_from_session_id),
    created_at: toDateTime(data.created_at),
    updated_at: toDateTime(data.updated_at),
  };
}

// "New since last session" = created after the previous session, by the OTHER
// party. No previous session anchor → never new. `>` on ts-luxon DateTime
// compares instants.
export function isTopicNew(
  topic: Pick<CoachingSessionTopic, "user_id" | "created_at">,
  viewerId: Id,
  previousSessionDate: Option<DateTime>
): boolean {
  return (
    previousSessionDate.some &&
    topic.user_id !== viewerId &&
    topic.created_at > previousSessionDate.val
  );
}

// `updated_at` is coarse — any mutation bumps it, so this gates a "Updated"
// (never "Edited") provenance line.
export function topicWasUpdated(
  topic: Pick<CoachingSessionTopic, "created_at" | "updated_at">
): boolean {
  return topic.updated_at > topic.created_at;
}

export function defaultCoachingSessionTopic(): CoachingSessionTopic {
  const now = DateTime.now();
  return {
    id: "",
    coaching_session_id: "",
    user_id: "",
    body: "",
    priority: None,
    status: TopicStatus.Open,
    moved_from_session_id: None,
    created_at: now,
    updated_at: now,
  };
}
