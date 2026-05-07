import useSWR from "swr";
import { siteConfig } from "@/site.config";
import { EntityApi } from "@/lib/api/entity-api";
import type { Id } from "@/types/general";
import type { Transcription, TranscriptSegment } from "@/types/transcription";

const COACHING_SESSIONS_BASEURL = `${siteConfig.env.backendServiceURL}/coaching_sessions`;
const TRANSCRIPTIONS_PATH = "transcriptions";
const SEGMENTS_PATH = "transcription_segments";

export const TranscriptionApi = {
  get: (sessionId: Id): Promise<Transcription | null> =>
    EntityApi.getFn<Transcription | null>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/${TRANSCRIPTIONS_PATH}`
    ),

  listNested: (sessionId: Id, transcriptionId: Id): Promise<TranscriptSegment[]> =>
    EntityApi.listNestedFn<TranscriptSegment>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/${TRANSCRIPTIONS_PATH}`,
      transcriptionId,
      SEGMENTS_PATH,
      {}
    ),
};

export function useTranscription(sessionId: Id | null) {
  const url = sessionId
    ? `${COACHING_SESSIONS_BASEURL}/${sessionId}/${TRANSCRIPTIONS_PATH}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<Transcription | null>(
    url,
    () => TranscriptionApi.get(sessionId!),
  );

  return {
    transcription: data ?? null,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}

export function useTranscriptionSegments(
  sessionId: Id | null,
  transcriptionId: Id | null
) {
  const url =
    sessionId && transcriptionId
      ? `${COACHING_SESSIONS_BASEURL}/${sessionId}/${TRANSCRIPTIONS_PATH}/${transcriptionId}/${SEGMENTS_PATH}`
      : null;

  const { data, error, isLoading } = useSWR<TranscriptSegment[]>(
    url,
    () => TranscriptionApi.listNested(sessionId!, transcriptionId!),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  return {
    segments: data ?? [],
    isLoading,
    isError: error,
  };
}
