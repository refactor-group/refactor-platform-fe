import useSWR, { type KeyedMutator } from "swr";
import { siteConfig } from "@/site.config";
import { EntityApi } from "@/lib/api/entity-api";
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

  start: async (
    sessionId: Id,
    meetingUrl: string
  ): Promise<MeetingRecording> => {
    const raw = await EntityApi.createFn<{ meeting_url: string }, unknown>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/meeting_recording`,
      { meeting_url: meetingUrl }
    );
    return parseMeetingRecording(raw);
  },

  stop: async (sessionId: Id): Promise<MeetingRecording> => {
    const raw = await EntityApi.deleteFn<null, unknown>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/meeting_recording`
    );
    return parseMeetingRecording(raw);
  },
};

export interface UseMeetingRecording {
  recording: MeetingRecording | null;
  isLoading: boolean;
  isError: Error | undefined;
  refresh: KeyedMutator<MeetingRecording | null>;
  startRecording: (meetingUrl: string) => Promise<MeetingRecording>;
  stopRecording: () => Promise<MeetingRecording>;
}

export function useMeetingRecording(sessionId: Id | null): UseMeetingRecording {
  const url = sessionId
    ? `${COACHING_SESSIONS_BASEURL}/${sessionId}/meeting_recording`
    : null;

  const { data, error, isLoading, mutate } = useSWR<MeetingRecording | null>(
    url,
    () => MeetingRecordingApi.get(sessionId!),
    { revalidateOnFocus: true }
  );

  const startRecording = async (meetingUrl: string): Promise<MeetingRecording> => {
    const created = await MeetingRecordingApi.start(sessionId!, meetingUrl);
    await mutate(created, { revalidate: false });
    return created;
  };

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
