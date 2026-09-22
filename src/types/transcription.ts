import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";

// Must always reflect the Rust entity types on the backend.
// See refactor-platform-rs PR #254:
//   entity/src/transcription.rs
//   entity/src/transcript_segment.rs

/**
 * Lifecycle status for a transcription job, as returned by the backend.
 * String values match the serialized SeaORM enum names exactly so the
 * values can be used interchangeably with raw API payloads.
 */
export enum TranscriptionStatus {
  Queued = "queued",
  Processing = "processing",
  Completed = "completed",
  Failed = "failed",
}

/** Narrowing guard for unknown strings incoming from the API. */
export function isTranscriptionStatus(value: unknown): value is TranscriptionStatus {
  return (
    value === TranscriptionStatus.Queued ||
    value === TranscriptionStatus.Processing ||
    value === TranscriptionStatus.Completed ||
    value === TranscriptionStatus.Failed
  );
}

/**
 * Sentiment label from AssemblyAI/Recall.ai.
 * Kept as a union of literals to match the raw string values the backend
 * passes through without transformation.
 */
export enum TranscriptSegmentSentiment {
  Positive = "positive",
  Neutral = "neutral",
  Negative = "negative",
}

export function isTranscriptSegmentSentiment(
  value: unknown
): value is TranscriptSegmentSentiment {
  return (
    value === TranscriptSegmentSentiment.Positive ||
    value === TranscriptSegmentSentiment.Neutral ||
    value === TranscriptSegmentSentiment.Negative
  );
}

/**
 * Metadata for a single transcription of a coaching session's recording.
 * The text itself lives in an ordered list of `TranscriptSegment`s fetched
 * separately; this object describes the transcription job and its outcome.
 */
export interface Transcription {
  id: Id;
  coaching_session_id: Id;
  meeting_recording_id: Id;
  /** Recall.ai's transcript id — not usually needed on the client. */
  external_id: string;
  status: TranscriptionStatus;
  language_code?: string;
  speaker_count?: number;
  word_count?: number;
  duration_seconds?: number;
  confidence?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

/**
 * A single segment of spoken text from a transcription.
 *
 * Speaker labels are raw strings from AssemblyAI (e.g. `"Speaker A"`) with
 * no backend-side mapping to user identity; the UI must be prepared to
 * display them as-is. See the implementation plan's "Speaker labels in v1"
 * section for the rationale.
 */
export interface TranscriptSegment {
  id: Id;
  transcription_id: Id;
  speaker_label: string;
  text: string;
  /** Start offset within the recording, in milliseconds. */
  start_ms: number;
  /** End offset within the recording, in milliseconds. */
  end_ms: number;
  confidence?: number;
  sentiment?: TranscriptSegmentSentiment;
  created_at: string;
}

/**
 * Validates and narrows an API payload to `Transcription`. Throws on
 * shape drift so SWR surfaces it as `error` rather than silently
 * narrowing to an invalid TS value.
 */
export function parseTranscription(value: unknown): Transcription {
  if (typeof value !== "object" || value === null) {
    throw new Error("Transcription payload is not an object");
  }
  const record = value as { status?: unknown };
  if (!isTranscriptionStatus(record.status)) {
    throw new Error(`Unknown transcription status: ${String(record.status)}`);
  }
  return value as Transcription;
}

/**
 * Validates a single `TranscriptSegment`. The optional `sentiment` field
 * is dropped if it's an unrecognized value — segments are still useful
 * without sentiment, so this is a softer parse than the status-bearing
 * entities above.
 */
export function parseTranscriptSegment(value: unknown): TranscriptSegment {
  if (typeof value !== "object" || value === null) {
    throw new Error("TranscriptSegment payload is not an object");
  }
  const record = value as { sentiment?: unknown };
  if (
    record.sentiment !== undefined &&
    !isTranscriptSegmentSentiment(record.sentiment)
  ) {
    const { sentiment: _drop, ...rest } = value as TranscriptSegment & {
      sentiment?: unknown;
    };
    return rest as TranscriptSegment;
  }
  return value as TranscriptSegment;
}

/**
 * Which participant in the coaching relationship a speaker label resolved to.
 * Values are the exact query-param strings the download endpoint accepts.
 */
export enum SpeakerRole {
  Coach = "coach",
  Coachee = "coachee",
}

export function isSpeakerRole(value: unknown): value is SpeakerRole {
  return value === SpeakerRole.Coach || value === SpeakerRole.Coachee;
}

/**
 * A distinct speaker label and the participant the backend matched it to.
 *
 * `role` is None when the match failed. A coaching session has only the two
 * people in its relationship, so None never means a third party.
 */
export interface Speaker {
  label: string;
  role: Option<SpeakerRole>;
}

/** The id-keyed transcription read, which carries the resolved speakers. */
export interface TranscriptionWithSpeakers extends Transcription {
  speakers: Speaker[];
}

export function parseTranscriptionWithSpeakers(
  value: unknown
): TranscriptionWithSpeakers {
  const transcription = parseTranscription(value);
  const raw = (value as { speakers?: unknown }).speakers;
  return {
    ...transcription,
    speakers: Array.isArray(raw) ? raw.map(parseSpeaker) : [],
  };
}

// Wire `role` is "coach" | "coachee" | null. Narrowed to Option here so no
// caller downstream has to think about null.
function parseSpeaker(value: unknown): Speaker {
  if (typeof value !== "object" || value === null) {
    throw new Error("Speaker payload is not an object");
  }
  const record = value as { label?: unknown; role?: unknown };
  if (typeof record.label !== "string") {
    throw new Error("Speaker payload is missing a label");
  }
  return {
    label: record.label,
    role: isSpeakerRole(record.role) ? Some(record.role) : None,
  };
}
