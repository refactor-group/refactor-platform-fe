import { useApiSWR } from "@/lib/hooks/use-api-swr";
import { type KeyedMutator } from "swr";
import { siteConfig } from "@/site.config";
import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { EntityApi } from "@/lib/api/entity-api";
import { EntityApiError, conflictReasonOf } from "@/types/entity-api-error";
import type { Id } from "@/types/general";
import {
  parseMeetingRecording,
  type MeetingRecording,
} from "@/types/meeting-recording";

const COACHING_SESSIONS_BASEURL = `${siteConfig.env.backendServiceURL}/coaching_sessions`;

// The GET endpoint returns null when no recording exists for the session;
// the create/delete endpoints always return a recording. All three are
// validated through `parseMeetingRecording` so an unknown backend status
// surfaces as an SWR error instead of silently masquerading as a known one.
export const MeetingRecordingApi = {
  get: async (sessionId: Id): Promise<MeetingRecording | null> => {
    const raw = await EntityApi.getFn<unknown>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/meeting_recording`
    );
    return raw === null ? null : parseMeetingRecording(raw);
  },

  start: (sessionId: Id, meetingUrl: string): ResultAsync<MeetingRecording, EntityApiError> => {
    const url = `${COACHING_SESSIONS_BASEURL}/${sessionId}/meeting_recording`;
    return ResultAsync.fromPromise(
      EntityApi.createFn<{ meeting_url: string }, unknown>(url, { meeting_url: meetingUrl }).then(
        parseMeetingRecording
      ),
      (e) => EntityApiError.from("POST", url, e)
    );
  },

  stop: async (sessionId: Id): Promise<MeetingRecording> => {
    const raw = await EntityApi.deleteFn<null, unknown>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/meeting_recording`
    );
    return parseMeetingRecording(raw);
  },
};

/** One bot per session: the other participant may have started it first. */
export type RecordingStart =
  | { kind: "started"; recording: MeetingRecording }
  | { kind: "already_active" };

const isAlreadyActive = (error: EntityApiError): boolean => {
  const reason = conflictReasonOf(error);
  return reason.some && reason.val === "recording_already_active";
};

export interface UseMeetingRecording {
  recording: MeetingRecording | null;
  isLoading: boolean;
  isError: Error | undefined;
  refresh: KeyedMutator<MeetingRecording | null>;
  /** A recording already running counts as success: the button just joins it. */
  startRecording: (meetingUrl: string) => ResultAsync<RecordingStart, EntityApiError>;
  stopRecording: () => Promise<MeetingRecording>;
}

export function useMeetingRecording(sessionId: Id | null): UseMeetingRecording {
  const url = sessionId
    ? `${COACHING_SESSIONS_BASEURL}/${sessionId}/meeting_recording`
    : null;

  const { data, error, isLoading, mutate } = useApiSWR<MeetingRecording | null>(
    url,
    () => MeetingRecordingApi.get(sessionId!),
    { revalidateOnFocus: true }
  );

  const startRecording = (meetingUrl: string): ResultAsync<RecordingStart, EntityApiError> =>
    MeetingRecordingApi.start(sessionId!, meetingUrl)
      .map((recording): RecordingStart => {
        void mutate(recording, { revalidate: false });
        return { kind: "started", recording };
      })
      .orElse((error) => {
        if (!isAlreadyActive(error)) return errAsync(error);
        // Read the recording the other participant started, so this button shows it.
        void mutate();
        return okAsync<RecordingStart, EntityApiError>({ kind: "already_active" });
      });

  const stopRecording = async (): Promise<MeetingRecording> => {
    const updated = await MeetingRecordingApi.stop(sessionId!);
    await mutate(updated, { revalidate: false });
    return updated;
  };

  return {
    recording: data ?? null,
    isLoading,
    isError: error,
    refresh: mutate,
    startRecording,
    stopRecording,
  };
}
