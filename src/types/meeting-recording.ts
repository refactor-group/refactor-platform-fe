import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";

/**
 * Status of a meeting recording in the Recall.ai pipeline.
 */
export enum RecordingStatus {
  Pending = "pending",
  Joining = "joining",
  Recording = "recording",
  Processing = "processing",
  Completed = "completed",
  Failed = "failed",
}

/**
 * Status of a transcription in the AssemblyAI pipeline.
 */
export enum TranscriptionStatus {
  Pending = "pending",
  Processing = "processing",
  Completed = "completed",
  Failed = "failed",
}

/**
 * Sentiment analysis result for a transcript segment.
 */
export enum Sentiment {
  Positive = "positive",
  Neutral = "neutral",
  Negative = "negative",
}

/**
 * Type of AI-suggested item.
 */
export enum AiSuggestionType {
  Action = "action",
  Agreement = "agreement",
}

/**
 * Status of an AI-suggested item.
 */
export enum AiSuggestionStatus {
  Pending = "pending",
  Accepted = "accepted",
  Dismissed = "dismissed",
}

/**
 * Meeting recording entity.
 * Tracks Recall.ai bot recording sessions.
 */
export interface MeetingRecording {
  id: Id;
  coaching_session_id: Id;
  recall_bot_id: string | null;
  status: RecordingStatus;
  recording_url: string | null;
  duration_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
  error_message: string | null;
  created_at: DateTime;
  updated_at: DateTime;
}

/**
 * Transcription entity.
 * Stores AssemblyAI transcript data.
 */
export interface Transcription {
  id: Id;
  meeting_recording_id: Id;
  assemblyai_transcript_id: string | null;
  status: TranscriptionStatus;
  full_text: string | null;
  summary: string | null;
  confidence_score: number | null;
  word_count: number | null;
  language_code: string;
  error_message: string | null;
  created_at: DateTime;
  updated_at: DateTime;
}

/**
 * Transcript segment (utterance with speaker diarization).
 */
export interface TranscriptSegment {
  id: Id;
  transcription_id: Id;
  speaker_label: string;
  speaker_user_id: Id | null;
  text: string;
  start_time_ms: number;
  end_time_ms: number;
  confidence: number | null;
  sentiment: Sentiment | null;
  created_at: DateTime;
}

/**
 * AI-suggested action item or agreement.
 * Pending user approval before becoming an official entity.
 */
export interface AiSuggestedItem {
  id: Id;
  transcription_id: Id;
  item_type: AiSuggestionType;
  content: string;
  source_text: string | null;
  confidence: number | null;
  status: AiSuggestionStatus;
  accepted_entity_id: Id | null;
  created_at: DateTime;
  updated_at: DateTime;
}

/**
 * Type guard for MeetingRecording.
 */
export function isMeetingRecording(value: unknown): value is MeetingRecording {
  if (!value || typeof value !== "object") {
    return false;
  }
  const object = value as Record<string, unknown>;

  return (
    typeof object.id === "string" &&
    typeof object.coaching_session_id === "string" &&
    typeof object.status === "string"
  );
}

/**
 * Type guard for Transcription.
 */
export function isTranscription(value: unknown): value is Transcription {
  if (!value || typeof value !== "object") {
    return false;
  }
  const object = value as Record<string, unknown>;

  return (
    typeof object.id === "string" &&
    typeof object.meeting_recording_id === "string" &&
    typeof object.status === "string"
  );
}

/**
 * Type guard for AiSuggestedItem.
 */
export function isAiSuggestedItem(value: unknown): value is AiSuggestedItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const object = value as Record<string, unknown>;

  return (
    typeof object.id === "string" &&
    typeof object.transcription_id === "string" &&
    typeof object.item_type === "string" &&
    typeof object.content === "string" &&
    typeof object.status === "string"
  );
}

/**
 * Returns a default empty MeetingRecording.
 */
export function defaultMeetingRecording(): MeetingRecording {
  const now = DateTime.now();
  return {
    id: "",
    coaching_session_id: "",
    recall_bot_id: null,
    status: RecordingStatus.Pending,
    recording_url: null,
    duration_seconds: null,
    started_at: null,
    ended_at: null,
    error_message: null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Returns a default empty Transcription.
 */
export function defaultTranscription(): Transcription {
  const now = DateTime.now();
  return {
    id: "",
    meeting_recording_id: "",
    assemblyai_transcript_id: null,
    status: TranscriptionStatus.Pending,
    full_text: null,
    summary: null,
    confidence_score: null,
    word_count: null,
    language_code: "en",
    error_message: null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Formats duration in seconds to a human-readable string (MM:SS or HH:MM:SS).
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) {
    return "00:00";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Formats milliseconds to a timestamp string (MM:SS).
 */
export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
