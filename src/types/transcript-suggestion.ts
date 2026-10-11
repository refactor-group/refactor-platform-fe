import { DateTime } from "ts-luxon";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";
import {
  isAction,
  transformActionWithAssignees,
  type Action,
  type ActionWithAssigneesWire,
} from "@/types/action";
import { isSpeakerRole, type SpeakerRole } from "@/types/transcription";

// Must always reflect the Rust types on the backend.
// See refactor-platform-rs PR #441:
//   domain/src/transcript_suggestion/review.rs
//   domain/src/transcript_suggestion/actions.rs

/** Where a suggestion's default due date came from. */
export enum DueSource {
  NextSession = "next_session",
  SevenDays = "seven_days",
}

export function isDueSource(value: unknown): value is DueSource {
  return value === DueSource.NextSession || value === DueSource.SevenDays;
}

/** A suggestion's review status, as a list filter. */
export enum SuggestionStatus {
  Pending = "pending",
  Dismissed = "dismissed",
}

/** Where a transcript's scan for suggestions stands. */
export enum ScanStatus {
  Unavailable = "unavailable",
  None = "none",
  Pending = "pending",
  Processing = "processing",
  Completed = "completed",
  Failed = "failed",
}

const SCAN_STATUSES: readonly string[] = Object.values(ScanStatus);

export function isScanStatus(value: unknown): value is ScanStatus {
  return typeof value === "string" && SCAN_STATUSES.includes(value);
}

/** The Action a suggestion would create, plus the spoken due phrase. */
export interface ActionProposal extends Action {
  due_phrase: Option<string>;
}

/** The transcript segment a suggestion was extracted from. */
export interface SourceSegment {
  id: Id;
  /** Start offset within the recording, in milliseconds. */
  start_ms: number;
  speaker_role: Option<SpeakerRole>;
  speaker_label: string;
}

/** An existing action the suggestion likely repeats. */
export interface DuplicateOf {
  action_id: Id;
  body: Option<string>;
}

export interface DefaultDue {
  at: DateTime;
  source: DueSource;
}

export interface ActionSuggestion {
  id: Id;
  coaching_session_id: Id;
  proposal: ActionProposal;
  quote: string;
  segment: SourceSegment;
  duplicate_of: Option<DuplicateOf>;
  default_due: DefaultDue;
  created_at: DateTime;
  /** None while pending. */
  resolved_by: Option<Id>;
  resolved_at: Option<DateTime>;
}

/** Reviewer edits sent with an update or an accept. */
export interface ActionEdits {
  body: string;
  due_by: Option<DateTime>;
  assignee_ids: Id[];
  goal_id: Option<Id>;
}

type Wire = Record<string, unknown>;

function isRecord(value: unknown): value is Wire {
  return typeof value === "object" && value !== null;
}

function requireString(record: Wire, field: string, what: string): string {
  const value = record[field];
  if (typeof value !== "string") {
    throw new Error(`${what} has no string ${field}`);
  }
  return value;
}

function parseDateTime(value: unknown, what: string): DateTime {
  const dt = typeof value === "string" ? DateTime.fromISO(value) : null;
  if (!dt || !dt.isValid) {
    throw new Error(`${what} is not an ISO date: ${String(value)}`);
  }
  return dt;
}

function parseOptionalDateTime(value: unknown, what: string): Option<DateTime> {
  return value === null || value === undefined ? None : Some(parseDateTime(value, what));
}

function parseProposal(value: unknown): ActionProposal {
  if (!isAction(value)) {
    throw new Error("ActionSuggestion proposal is not an action");
  }
  const { due_phrase } = value as { due_phrase?: unknown };
  return {
    ...transformActionWithAssignees(value as unknown as ActionWithAssigneesWire),
    due_phrase: typeof due_phrase === "string" ? Some(due_phrase) : None,
  };
}

function parseSegment(value: unknown): SourceSegment {
  if (!isRecord(value)) {
    throw new Error("ActionSuggestion segment is not an object");
  }
  if (typeof value.start_ms !== "number") {
    throw new Error("ActionSuggestion segment has no numeric start_ms");
  }
  return {
    id: requireString(value, "id", "ActionSuggestion segment"),
    start_ms: value.start_ms,
    speaker_role: isSpeakerRole(value.speaker_role) ? Some(value.speaker_role) : None,
    speaker_label: requireString(value, "speaker_label", "ActionSuggestion segment"),
  };
}

function parseDuplicateOf(value: unknown): Option<DuplicateOf> {
  if (value === null || value === undefined) return None;
  if (!isRecord(value)) {
    throw new Error("ActionSuggestion duplicate_of is not an object");
  }
  return Some({
    action_id: requireString(value, "action_id", "ActionSuggestion duplicate_of"),
    body: typeof value.body === "string" ? Some(value.body) : None,
  });
}

function parseDefaultDue(value: unknown): DefaultDue {
  if (!isRecord(value)) {
    throw new Error("ActionSuggestion default_due is not an object");
  }
  if (!isDueSource(value.source)) {
    throw new Error(`Unknown default_due source: ${String(value.source)}`);
  }
  return {
    at: parseDateTime(value.at, "ActionSuggestion default_due.at"),
    source: value.source,
  };
}

/**
 * Validates and narrows an API payload to `ActionSuggestion`. Throws on
 * shape drift so SWR surfaces it as `error`.
 */
export function parseActionSuggestion(value: unknown): ActionSuggestion {
  if (!isRecord(value)) {
    throw new Error("ActionSuggestion payload is not an object");
  }
  return {
    id: requireString(value, "id", "ActionSuggestion"),
    coaching_session_id: requireString(value, "coaching_session_id", "ActionSuggestion"),
    proposal: parseProposal(value.proposal),
    quote: requireString(value, "quote", "ActionSuggestion"),
    segment: parseSegment(value.segment),
    duplicate_of: parseDuplicateOf(value.duplicate_of),
    default_due: parseDefaultDue(value.default_due),
    created_at: parseDateTime(value.created_at, "ActionSuggestion created_at"),
    resolved_by: typeof value.resolved_by === "string" ? Some(value.resolved_by) : None,
    resolved_at: parseOptionalDateTime(value.resolved_at, "ActionSuggestion resolved_at"),
  };
}

/** Wire body for an update or an accept. */
export interface ActionEditsWire {
  body: string;
  due_by: string | null;
  assignee_ids: Id[];
  goal_id: Id | null;
}

export function serializeActionEdits(edits: ActionEdits): ActionEditsWire {
  return {
    body: edits.body,
    due_by: edits.due_by.some ? edits.due_by.val.toISO() : null,
    assignee_ids: edits.assignee_ids,
    goal_id: edits.goal_id.some ? edits.goal_id.val : null,
  };
}
