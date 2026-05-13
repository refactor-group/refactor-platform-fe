import useSWR, { type KeyedMutator } from "swr";
import { siteConfig } from "@/site.config";
import { EntityApi } from "@/lib/api/entity-api";
import type { Id } from "@/types/general";
import {
  parseTranscription,
  parseTranscriptSegment,
  type Transcription,
  type TranscriptSegment,
} from "@/types/transcription";

const COACHING_SESSIONS_BASEURL = `${siteConfig.env.backendServiceURL}/coaching_sessions`;
const TRANSCRIPTIONS_PATH = "transcriptions";
const SEGMENTS_PATH = "transcription_segments";

// Both endpoints route raw API payloads through the boundary parsers so
// unknown enum variants from the backend turn into an SWR error rather
// than narrowing silently to an invalid TS value.
export const TranscriptionApi = {
  get: async (sessionId: Id): Promise<Transcription | null> => {
    const raw = await EntityApi.getFn<unknown>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/${TRANSCRIPTIONS_PATH}`
    );
    return raw === null ? null : parseTranscription(raw);
  },

  listNested: async (
    sessionId: Id,
    transcriptionId: Id
  ): Promise<TranscriptSegment[]> => {
    const raw = await EntityApi.listNestedFn<unknown>(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/${TRANSCRIPTIONS_PATH}`,
      transcriptionId,
      SEGMENTS_PATH,
      {}
    );
    return raw.map(parseTranscriptSegment);
  },
};

export interface UseTranscription {
  transcription: Transcription | null;
  isLoading: boolean;
  isError: Error | undefined;
  refresh: KeyedMutator<Transcription | null>;
}

export function useTranscription(sessionId: Id | null): UseTranscription {
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

export interface UseTranscriptionSegments {
  segments: TranscriptSegment[];
  isLoading: boolean;
  isError: Error | undefined;
}

export function useTranscriptionSegments(
  sessionId: Id | null,
  transcriptionId: Id | null
): UseTranscriptionSegments {
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
