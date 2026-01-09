import type { Id } from './general';
import type { Action } from './action';
import type { Agreement } from './agreement';
import type { OverarchingGoal } from './overarching-goal';

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

// ==================== AGREEMENT EVENTS (relationship-scoped) ====================

export type AgreementCreatedEvent = BaseSSEEvent<
  'agreement_created',
  {
    coaching_relationship_id: Id;
    agreement: Agreement;
  }
>;

export type AgreementUpdatedEvent = BaseSSEEvent<
  'agreement_updated',
  {
    coaching_relationship_id: Id;
    agreement: Agreement;
  }
>;

export type AgreementDeletedEvent = BaseSSEEvent<
  'agreement_deleted',
  {
    coaching_relationship_id: Id;
    agreement_id: Id;
  }
>;

// ==================== OVERARCHING GOAL EVENTS (relationship-scoped) ====================

export type OverarchingGoalCreatedEvent = BaseSSEEvent<
  'overarching_goal_created',
  {
    coaching_relationship_id: Id;
    overarching_goal: OverarchingGoal;
  }
>;

export type OverarchingGoalUpdatedEvent = BaseSSEEvent<
  'overarching_goal_updated',
  {
    coaching_relationship_id: Id;
    overarching_goal: OverarchingGoal;
  }
>;

export type OverarchingGoalDeletedEvent = BaseSSEEvent<
  'overarching_goal_deleted',
  {
    coaching_relationship_id: Id;
    overarching_goal_id: Id;
  }
>;

// ==================== SYSTEM EVENTS ====================

export type ForceLogoutEvent = BaseSSEEvent<
  'force_logout',
  {
    reason: string;
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
  | OverarchingGoalCreatedEvent
  | OverarchingGoalUpdatedEvent
  | OverarchingGoalDeletedEvent
  | ForceLogoutEvent;
