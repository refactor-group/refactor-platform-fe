// ─── Search Types (GET /search) ──────────────────────────────────────
// Mirrors the backend's keyword search contract: one endpoint, one merged
// hit list across entity types, keyset pagination via an opaque cursor.

import { Id, ItemStatus } from "@/types/general";
import { type Option, Some, None } from "@/types/option";
import { TopicPriority, TopicStatus } from "@/types/coaching-session-topic";

/** Hit variants the frontend knows how to render and link to. */
export enum SearchHitType {
  CoachingSession = "coaching_session",
  Goal = "goal",
  Action = "action",
  Agreement = "agreement",
  Topic = "topic",
}

/** Values accepted by the `types` query parameter. */
export enum SearchableType {
  CoachingSessions = "coaching_sessions",
  Goals = "goals",
  Actions = "actions",
  Agreements = "agreements",
  Topics = "topics",
}

export enum SearchMode {
  Keyword = "keyword",
  Semantic = "semantic",
  Hybrid = "hybrid",
}

/** Stable machine-readable discriminators on 400 responses. */
export enum SearchErrorCode {
  QueryTooShort = "query_too_short",
  UnknownType = "unknown_type",
  ContradictoryParams = "contradictory_params",
  MalformedCursor = "malformed_cursor",
  ModeUnavailable = "mode_unavailable",
  KeywordWeightOutOfRange = "keyword_weight_out_of_range",
  InvalidTimezone = "invalid_timezone",
}

/** Backend enforces this after trimming; mirrored client-side to skip the round trip. */
export const SEARCH_MIN_QUERY_LENGTH = 2;
/** Backend silently truncates longer queries. */
export const SEARCH_MAX_QUERY_LENGTH = 256;

interface SearchHitBase {
  id: Id;
  score: number;
  title: string;
  snippet: Option<string>;
  created_at: string;
  updated_at: string;
  organization_id: Id;
  coaching_relationship_id: Option<Id>;
}

export interface CoachingSessionHit extends SearchHitBase {
  type: SearchHitType.CoachingSession;
  date: string;
  display_title: string;
}

export interface GoalHit extends SearchHitBase {
  type: SearchHitType.Goal;
  status: ItemStatus;
  created_in_session_id: Option<Id>;
}

export interface ActionHit extends SearchHitBase {
  type: SearchHitType.Action;
  coaching_session_id: Option<Id>;
  goal_id: Option<Id>;
  status: ItemStatus;
  due_by: Option<string>;
  session_date: Option<string>;
  session_display_title: Option<string>;
}

export interface AgreementHit extends SearchHitBase {
  type: SearchHitType.Agreement;
  coaching_session_id: Option<Id>;
  session_date: Option<string>;
  session_display_title: Option<string>;
}

export interface TopicHit extends SearchHitBase {
  type: SearchHitType.Topic;
  coaching_session_id: Option<Id>;
  status: TopicStatus;
  priority: Option<TopicPriority>;
}

export type SearchHit =
  | CoachingSessionHit
  | GoalHit
  | ActionHit
  | AgreementHit
  | TopicHit;

/** The wire response also echoes `query` and `limit`; nothing here reads them, so they are not modeled. */
export interface SearchResponse {
  hits: SearchHit[];
  next_cursor: Option<string>;
}

/** Client-side filters. Everything is optional except `q`. */
export interface SearchParams {
  q: string;
  types?: SearchableType[];
  organization_id?: Id;
  coaching_relationship_id?: Id;
  user_id?: Id;
  coaching_session_id?: Id;
  goal_id?: Id;
  goal_filter?: "all" | "linked" | "unlinked";
  status?: ItemStatus;
  topic_status?: TopicStatus;
  created_from?: string;
  created_to?: string;
  updated_from?: string;
  updated_to?: string;
  tz?: string;
  limit?: number;
  cursor?: string;
  mode?: SearchMode;
}

/** Typed failure at the search API boundary. */
export type SearchError =
  | { kind: "validation"; code: SearchErrorCode; message: string }
  | { kind: "rate_limited" }
  | { kind: "unavailable" }
  | { kind: "network" }
  | { kind: "unknown"; message: string };

// ─── Parsing ─────────────────────────────────────────────────────────

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): Option<string> {
  return typeof value === "string" ? Some(value) : None;
}

function requireString(obj: Raw, field: string): string {
  const value = obj[field];
  if (typeof value !== "string") {
    throw new Error(`Invalid search hit: expected string \`${field}\``);
  }
  return value;
}

function parseEnum<E extends string>(
  values: readonly E[],
  value: unknown,
  fallback: E
): E {
  return values.includes(value as E) ? (value as E) : fallback;
}

function parseBase(obj: Raw): SearchHitBase {
  const score = obj.score;
  if (typeof score !== "number") {
    throw new Error("Invalid search hit: expected number `score`");
  }
  return {
    id: requireString(obj, "id"),
    score,
    title: requireString(obj, "title"),
    snippet: optionalString(obj.snippet),
    created_at: requireString(obj, "created_at"),
    updated_at: requireString(obj, "updated_at"),
    organization_id: requireString(obj, "organization_id"),
    coaching_relationship_id: optionalString(obj.coaching_relationship_id),
  };
}

const ITEM_STATUSES = Object.values(ItemStatus);
const TOPIC_STATUSES = Object.values(TopicStatus);
const TOPIC_PRIORITIES = Object.values(TopicPriority);

/**
 * Parses one raw hit. Returns `None` for hit types this client doesn't know,
 * which the backend adds additively over time and asks us to ignore.
 */
export function parseSearchHit(value: unknown): Option<SearchHit> {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error("Invalid search hit: expected object with string `type`");
  }

  switch (value.type) {
    case SearchHitType.CoachingSession:
      return Some({
        ...parseBase(value),
        type: SearchHitType.CoachingSession,
        date: requireString(value, "date"),
        display_title: requireString(value, "display_title"),
      });
    case SearchHitType.Goal:
      return Some({
        ...parseBase(value),
        type: SearchHitType.Goal,
        status: parseEnum(ITEM_STATUSES, value.status, ItemStatus.NotStarted),
        created_in_session_id: optionalString(value.created_in_session_id),
      });
    case SearchHitType.Action:
      return Some({
        ...parseBase(value),
        type: SearchHitType.Action,
        coaching_session_id: optionalString(value.coaching_session_id),
        goal_id: optionalString(value.goal_id),
        status: parseEnum(ITEM_STATUSES, value.status, ItemStatus.NotStarted),
        due_by: optionalString(value.due_by),
        session_date: optionalString(value.session_date),
        session_display_title: optionalString(value.session_display_title),
      });
    case SearchHitType.Agreement:
      return Some({
        ...parseBase(value),
        type: SearchHitType.Agreement,
        coaching_session_id: optionalString(value.coaching_session_id),
        session_date: optionalString(value.session_date),
        session_display_title: optionalString(value.session_display_title),
      });
    case SearchHitType.Topic:
      return Some({
        ...parseBase(value),
        type: SearchHitType.Topic,
        coaching_session_id: optionalString(value.coaching_session_id),
        status: parseEnum(TOPIC_STATUSES, value.status, TopicStatus.Open),
        priority: TOPIC_PRIORITIES.includes(value.priority as TopicPriority)
          ? Some(value.priority as TopicPriority)
          : None,
      });
    default:
      return None;
  }
}

/** Validates and normalizes the `data` payload of a 200 search response. */
export function parseSearchResponse(value: unknown): SearchResponse {
  if (!isRecord(value) || !Array.isArray(value.hits)) {
    throw new Error("Invalid SearchResponse data");
  }

  const hits: SearchHit[] = [];
  for (const raw of value.hits) {
    const hit = parseSearchHit(raw);
    if (hit.some) hits.push(hit.val);
  }

  return { hits, next_cursor: optionalString(value.next_cursor) };
}

// ─── Snippets ────────────────────────────────────────────────────────

export interface SnippetSegment {
  text: string;
  highlighted: boolean;
}

const MARK_PATTERN = /<mark>([\s\S]*?)<\/mark>/g;

/**
 * Splits a backend snippet on its `<mark>` markers into plain and highlighted
 * text segments so it can be rendered as text nodes, never as HTML.
 */
export function splitSnippet(snippet: string): SnippetSegment[] {
  const segments: SnippetSegment[] = [];
  let cursor = 0;
  for (const match of snippet.matchAll(MARK_PATTERN)) {
    const start = match.index;
    if (start > cursor) {
      segments.push({ text: snippet.slice(cursor, start), highlighted: false });
    }
    if (match[1].length > 0) {
      segments.push({ text: match[1], highlighted: true });
    }
    cursor = start + match[0].length;
  }
  if (cursor < snippet.length) {
    segments.push({ text: snippet.slice(cursor), highlighted: false });
  }
  return segments;
}

/** True once a query is worth sending: backend rejects anything shorter after trimming. */
export function isSearchableQuery(q: string): boolean {
  return q.trim().length >= SEARCH_MIN_QUERY_LENGTH;
}
