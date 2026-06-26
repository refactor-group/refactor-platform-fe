import type { Id } from './general';
import type { Action } from './action';
import type { Agreement } from './agreement';
import type { Goal } from './goal';

/**
 * Base SSE event structure matching backend serialization
 * Backend uses Rust #[serde(tag = "type", content = "data")]
 */
interface BaseSSEEvent<T extends string, D> {
  type: T;
  data: D;
}

// ==================== ACTION EVENTS (session-scoped) ====================

export type ActionCreatedEvent = BaseSSEEvent<
  'action_created',
  {
    coaching_session_id: Id;
    action: Action;
  }
>;

export type ActionUpdatedEvent = BaseSSEEvent<
  'action_updated',
  {
    coaching_session_id: Id;
    action: Action;
  }
>;

export type ActionDeletedEvent = BaseSSEEvent<
  'action_deleted',
  {
    coaching_session_id: Id;
    action_id: Id;
  }
>;

// ==================== AGREEMENT EVENTS (session-scoped) ====================

export type AgreementCreatedEvent = BaseSSEEvent<
  'agreement_created',
  {
    coaching_session_id: Id;
    agreement: Agreement;
  }
>;

export type AgreementUpdatedEvent = BaseSSEEvent<
  'agreement_updated',
  {
    coaching_session_id: Id;
    agreement: Agreement;
  }
>;

export type AgreementDeletedEvent = BaseSSEEvent<
  'agreement_deleted',
  {
    coaching_session_id: Id;
    agreement_id: Id;
  }
>;

// ==================== GOAL EVENTS (relationship-scoped) ====================

export type GoalCreatedEvent = BaseSSEEvent<
  'goal_created',
  {
    coaching_relationship_id: Id;
    goal: Goal;
  }
>;

export type GoalUpdatedEvent = BaseSSEEvent<
  'goal_updated',
  {
    coaching_relationship_id: Id;
    goal: Goal;
  }
>;

export type GoalDeletedEvent = BaseSSEEvent<
  'goal_deleted',
  {
    coaching_relationship_id: Id;
    goal_id: Id;
  }
>;

// ==================== COACHING SESSION GOAL EVENTS (join table, relationship-scoped) ====================

export type CoachingSessionGoalCreatedEvent = BaseSSEEvent<
  'coaching_session_goal_created',
  {
    coaching_relationship_id: Id;
    coaching_session_id: Id;
    goal_id: Id;
  }
>;

export type CoachingSessionGoalDeletedEvent = BaseSSEEvent<
  'coaching_session_goal_deleted',
  {
    coaching_relationship_id: Id;
    coaching_session_id: Id;
    goal_id: Id;
  }
>;

// ==================== SYSTEM EVENTS ====================

export type ForceLogoutEvent = BaseSSEEvent<
  'force_logout',
  {
    reason: string;
  }
>;

// ==================== MEETING RECORDING EVENTS (session-scoped) ====================

export type MeetingRecordingUpdatedEvent = BaseSSEEvent<
  'meeting_recording_updated',
  {
    coaching_session_id: Id;
  }
>;

// ==================== TRANSCRIPTION EVENTS (session-scoped) ====================

export type TranscriptionUpdatedEvent = BaseSSEEvent<
  'transcription_updated',
  {
    coaching_session_id: Id;
  }
>;

// ==================== COACHING SESSION TITLE EVENTS (session-scoped) ====================

// Coarse, like topics_changed: carries only the session id. Fires on a title
// PATCH by either participant. On receipt, refetch the session (single read and
// the enriched list reads that surface display_title).
export type CoachingSessionTitleUpdatedEvent = BaseSSEEvent<
  'coaching_session_title_updated',
  {
    coaching_session_id: Id;
  }
>;

// ==================== TOPIC EVENTS (session-scoped) ====================

// Coarse, like meeting_recording/transcription: carries only the session id.
// Fires on ANY topic mutation (add/edit/delete/reorder/priority/status) and on
// the server-side carry-over copy. On receipt, refetch that session's topics.
export type TopicsChangedEvent = BaseSSEEvent<
  'topics_changed',
  {
    coaching_session_id: Id;
  }
>;

/**
 * Discriminated union of all SSE events
 * TypeScript automatically narrows the type based on the 'type' property
 */
export type SSEEvent =
  | ActionCreatedEvent
  | ActionUpdatedEvent
  | ActionDeletedEvent
  | AgreementCreatedEvent
  | AgreementUpdatedEvent
  | AgreementDeletedEvent
  | GoalCreatedEvent
  | GoalUpdatedEvent
  | GoalDeletedEvent
  | CoachingSessionGoalCreatedEvent
  | CoachingSessionGoalDeletedEvent
  | ForceLogoutEvent
  | MeetingRecordingUpdatedEvent
  | TranscriptionUpdatedEvent
  | TopicsChangedEvent
  | CoachingSessionTitleUpdatedEvent;
