import type { Id } from "@/types/general";

// Must always reflect the Rust entity on the backend.
// See refactor-platform-rs PR #254: entity/src/meeting_recording.rs.

/**
 * Lifecycle status for a Recall.ai recording bot.
 *
 * String values match the serialized SeaORM enum names exactly so the
 * values can be used interchangeably with raw API payloads.
 */
export enum MeetingRecordingStatus {
  Pending = "pending",
  Joining = "joining",
  WaitingRoom = "waiting_room",
  InMeeting = "in_meeting",
  Recording = "recording",
  Processing = "processing",
  Completed = "completed",
  Failed = "failed",
  /** User cancelled mid-recording; terminal, may have a partial transcript. */
  Cancelled = "cancelled",
}

export function isMeetingRecordingStatus(
  value: unknown
): value is MeetingRecordingStatus {
  return (
    value === MeetingRecordingStatus.Pending ||
    value === MeetingRecordingStatus.Joining ||
    value === MeetingRecordingStatus.WaitingRoom ||
    value === MeetingRecordingStatus.InMeeting ||
    value === MeetingRecordingStatus.Recording ||
    value === MeetingRecordingStatus.Processing ||
    value === MeetingRecordingStatus.Completed ||
    value === MeetingRecordingStatus.Failed ||
    value === MeetingRecordingStatus.Cancelled
  );
}

/**
 * An active or completed recording for a coaching session.
 *
 * `audio_url` is intentionally absent — the backend omits it from API
 * serialization. `video_url` may be absent while the recording is in
 * progress and is populated after the bot finishes processing.
 */
export interface MeetingRecording {
  id: Id;
  coaching_session_id: Id;
  /** Recall.ai's bot id — exposed so the frontend can correlate webhook events if needed. */
  bot_id: string;
  status: MeetingRecordingStatus;
  video_url?: string;
  duration_seconds?: number;
  started_at?: string;
  ended_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Validates and narrows an API payload to `MeetingRecording`. Throws on
 * shape drift (e.g. a new backend status enum the frontend doesn't
 * recognize yet) so SWR surfaces it as `error` rather than silently
 * narrowing to an invalid TS value.
 *
 * `null` is passed through unchanged: the GET endpoint returns null when
 * no recording exists for the session.
 */
export function parseMeetingRecording(value: unknown): MeetingRecording {
  if (typeof value !== "object" || value === null) {
    throw new Error("MeetingRecording payload is not an object");
  }
  const record = value as { status?: unknown };
  if (!isMeetingRecordingStatus(record.status)) {
    throw new Error(
      `Unknown meeting recording status: ${String(record.status)}`
    );
  }
  return value as MeetingRecording;
}

/**
 * Recording statuses that represent an active, in-progress lifecycle —
 * i.e., the UI should poll for updates and show live-state chrome.
 */
export function isRecordingInProgress(status: MeetingRecordingStatus): boolean {
  return (
    status === MeetingRecordingStatus.Pending ||
    status === MeetingRecordingStatus.Joining ||
    status === MeetingRecordingStatus.WaitingRoom ||
    status === MeetingRecordingStatus.InMeeting ||
    status === MeetingRecordingStatus.Recording ||
    status === MeetingRecordingStatus.Processing
  );
}

/** Terminal states: polling should stop. */
export function isRecordingTerminal(status: MeetingRecordingStatus): boolean {
  return (
    status === MeetingRecordingStatus.Completed ||
    status === MeetingRecordingStatus.Failed ||
    status === MeetingRecordingStatus.Cancelled
  );
}
