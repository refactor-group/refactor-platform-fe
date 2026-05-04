import useSWR from "swr";
import { siteConfig } from "@/site.config";
import { EntityApi } from "@/lib/api/entity-api";
import type { Id } from "@/types/general";
import type { MeetingRecording } from "@/types/meeting-recording";
import { isRecordingInProgress } from "@/types/meeting-recording";

const COACHING_SESSIONS_BASEURL = `${siteConfig.env.backendServiceURL}/coaching_sessions`;

export const MeetingRecordingApi = {
  get: (sessionId: Id): Promise<MeetingRecording | null> =>
    EntityApi.getFn<MeetingRecording | null>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/meeting_recording`
    ),

  start: (sessionId: Id, meetingUrl: string): Promise<MeetingRecording> =>
    EntityApi.createFn<{ meeting_url: string }, MeetingRecording>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/meeting_recording`,
      { meeting_url: meetingUrl }
    ),

  stop: (sessionId: Id): Promise<MeetingRecording> =>
    EntityApi.deleteFn<null, MeetingRecording>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/meeting_recording`
    ),
};

export function useMeetingRecording(sessionId: Id | null) {
  const url = sessionId
    ? `${COACHING_SESSIONS_BASEURL}/${sessionId}/meeting_recording`
    : null;

  const { data, error, isLoading, mutate } = useSWR<MeetingRecording | null>(
    url,
    () => MeetingRecordingApi.get(sessionId!),
    {
      refreshInterval: (latestData) => {
        if (!latestData) return 0;
        return isRecordingInProgress(latestData.status) ? 5_000 : 0;
      },
      refreshWhenHidden: false,
      revalidateOnFocus: true,
    }
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
