import type { Id } from "@/types/general";

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
