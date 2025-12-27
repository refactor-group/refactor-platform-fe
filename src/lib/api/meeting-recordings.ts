// Interacts with the meeting recordings and transcription endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { EntityApi } from "./entity-api";
import {
  MeetingRecording,
  Transcription,
  TranscriptSegment,
  defaultMeetingRecording,
  defaultTranscription,
} from "@/types/meeting-recording";

/**
 * Extracted action from LeMUR analysis.
 */
export interface ExtractedAction {
  content: string;
  source_text: string;
  stated_by_speaker: string;
  assigned_to_role: string;
  /** Name of the person assigned (extracted from transcript) */
  assigned_to_name?: string | null;
  /** Due date in ISO 8601 format (e.g., "2025-01-15") if mentioned in transcript */
  due_by?: string | null;
  confidence: number;
  start_time_ms: number | null;
  end_time_ms: number | null;
}

/**
 * Extracted agreement from LeMUR analysis.
 */
export interface ExtractedAgreement {
  content: string;
  source_text: string;
  stated_by_speaker: string;
  confidence: number;
  start_time_ms: number | null;
  end_time_ms: number | null;
}

/**
 * Response from triggering action extraction via LeMUR.
 * Returns immediately - actions are created asynchronously.
 */
export interface ExtractActionsResponse {
  session_id: Id;
  transcription_id: Id;
  /** Status of the extraction request: "processing" or "error" */
  status: string;
  /** Human-readable message about the extraction status */
  message: string;
}

/**
 * Response from extracting agreements via LeMUR.
 */
export interface ExtractAgreementsResponse {
  session_id: Id;
  transcription_id: Id;
  agreements: ExtractedAgreement[];
  created_count: number;
}

export const COACHING_SESSIONS_BASEURL: string = `${siteConfig.env.backendServiceURL}/coaching_sessions`;

/**
 * Response from starting a recording.
 */
export interface StartRecordingResponse {
  recording: MeetingRecording;
  message: string;
}

/**
 * Response from stopping a recording.
 */
export interface StopRecordingResponse {
  recording: MeetingRecording;
  message: string;
}

/**
 * API client for meeting recording operations.
 */
export const MeetingRecordingApi = {
  /**
   * Fetches the current recording for a coaching session.
   */
  get: async (sessionId: Id): Promise<MeetingRecording | null> => {
    try {
      return await EntityApi.getFn<MeetingRecording>(
        `${COACHING_SESSIONS_BASEURL}/${sessionId}/recording`
      );
    } catch {
      // Return null if no recording exists (404)
      return null;
    }
  },

  /**
   * Starts a new recording for a coaching session.
   */
  start: async (sessionId: Id): Promise<StartRecordingResponse> =>
    EntityApi.createFn<Record<string, never>, StartRecordingResponse>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/recording/start`,
      {}
    ),

  /**
   * Stops the current recording for a coaching session.
   */
  stop: async (sessionId: Id): Promise<StopRecordingResponse> =>
    EntityApi.createFn<Record<string, never>, StopRecordingResponse>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/recording/stop`,
      {}
    ),

  /**
   * Fetches the transcript for a coaching session.
   */
  getTranscript: async (sessionId: Id): Promise<Transcription | null> => {
    try {
      return await EntityApi.getFn<Transcription>(
        `${COACHING_SESSIONS_BASEURL}/${sessionId}/transcript`
      );
    } catch {
      // Return null if no transcript exists (404)
      return null;
    }
  },

  /**
   * Fetches the transcript segments for a coaching session.
   */
  getTranscriptSegments: async (sessionId: Id): Promise<TranscriptSegment[]> => {
    try {
      return await EntityApi.getFn<TranscriptSegment[]>(
        `${COACHING_SESSIONS_BASEURL}/${sessionId}/transcript/segments`
      );
    } catch {
      // Return empty array if no segments exist
      return [];
    }
  },

  /**
   * Fetches the session summary.
   */
  getSummary: async (sessionId: Id): Promise<string | null> => {
    try {
      const transcript = await EntityApi.getFn<Transcription>(
        `${COACHING_SESSIONS_BASEURL}/${sessionId}/transcript`
      );
      return transcript?.summary ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Manually triggers LeMUR to extract actions from the transcript.
   * Creates Action entities directly.
   */
  extractActions: async (sessionId: Id): Promise<ExtractActionsResponse> =>
    EntityApi.createFn<Record<string, never>, ExtractActionsResponse>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/transcript/extract-actions`,
      {}
    ),

  /**
   * Manually triggers LeMUR to extract agreements from the transcript.
   * Creates Agreement entities directly.
   */
  extractAgreements: async (sessionId: Id): Promise<ExtractAgreementsResponse> =>
    EntityApi.createFn<Record<string, never>, ExtractAgreementsResponse>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/transcript/extract-agreements`,
      {}
    ),
};

/**
 * Hook for fetching the current recording for a session.
 */
export const useMeetingRecording = (sessionId: Id) => {
  const url = sessionId
    ? `${COACHING_SESSIONS_BASEURL}/${sessionId}/recording`
    : null;
  const fetcher = () => MeetingRecordingApi.get(sessionId);

  const { entity, isLoading, isError, refresh } =
    EntityApi.useEntity<MeetingRecording | null>(url, fetcher, null, {
      refreshInterval: 5000, // Poll every 5 seconds for status updates
      revalidateOnFocus: true,
    });

  return {
    recording: entity,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * Hook for fetching the transcript for a session.
 * Polls every 5 seconds while transcription is processing.
 */
export const useTranscript = (sessionId: Id) => {
  const url = sessionId
    ? `${COACHING_SESSIONS_BASEURL}/${sessionId}/transcript`
    : null;
  const fetcher = () => MeetingRecordingApi.getTranscript(sessionId);

  const { entity, isLoading, isError, refresh } =
    EntityApi.useEntity<Transcription | null>(url, fetcher, null, {
      refreshInterval: 5000, // Poll every 5 seconds for status updates
      revalidateOnFocus: true,
    });

  return {
    transcript: entity,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * Hook for fetching transcript segments for a session.
 * Polls every 5 seconds for updates.
 */
export const useTranscriptSegments = (sessionId: Id) => {
  const url = sessionId
    ? `${COACHING_SESSIONS_BASEURL}/${sessionId}/transcript/segments`
    : null;
  const fetcher = () => MeetingRecordingApi.getTranscriptSegments(sessionId);

  const { entity, isLoading, isError, refresh } = EntityApi.useEntity<
    TranscriptSegment[]
  >(url, fetcher, [], {
    refreshInterval: 5000, // Poll every 5 seconds for updates
    revalidateOnFocus: true,
  });

  return {
    segments: entity,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * Hook for meeting recording mutations.
 */
export const useMeetingRecordingMutation = (sessionId: Id) => {
  const startRecording = async (): Promise<StartRecordingResponse> => {
    return MeetingRecordingApi.start(sessionId);
  };

  const stopRecording = async (): Promise<StopRecordingResponse> => {
    return MeetingRecordingApi.stop(sessionId);
  };

  return {
    startRecording,
    stopRecording,
  };
};
