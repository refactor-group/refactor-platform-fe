import useSWR from "swr";
import { useEffect, useRef } from "react";
import { siteConfig } from "@/site.config";
import { EntityApi } from "@/lib/api/entity-api";
import type { Id } from "@/types/general";
import type { Transcription, TranscriptSegment } from "@/types/transcription";
import { TranscriptionStatus } from "@/types/transcription";

const COACHING_SESSIONS_BASEURL = `${siteConfig.env.backendServiceURL}/coaching_sessions`;
const TRANSCRIPTIONS_PATH = "transcriptions";
const SEGMENTS_PATH = "transcription_segments";

const THIRTY_MINUTES_MS = 30 * 60 * 1_000;

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

function isPollingStatus(status: TranscriptionStatus): boolean {
  return (
    status === TranscriptionStatus.Queued ||
    status === TranscriptionStatus.Processing
  );
}

export function useTranscription(sessionId: Id | null) {
  const url = sessionId
    ? `${COACHING_SESSIONS_BASEURL}/${sessionId}/${TRANSCRIPTIONS_PATH}`
    : null;

  const isVisibleRef = useRef(true);
  const pollingStartRef = useRef<number | null>(null);

  useEffect(() => {
    isVisibleRef.current = document.visibilityState === "visible";
    const handler = () => {
      isVisibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const { data, error, isLoading, mutate } = useSWR<Transcription | null>(
    url,
    () => TranscriptionApi.get(sessionId!),
    {
      refreshInterval: (latestData) => {
        if (!isVisibleRef.current) return 0;

        if (!latestData || !isPollingStatus(latestData.status)) {
          pollingStartRef.current = null;
          return 0;
        }

        if (pollingStartRef.current === null) {
          pollingStartRef.current = Date.now();
        }

        if (Date.now() - pollingStartRef.current >= THIRTY_MINUTES_MS) {
          return 0;
        }

        return 10_000;
      },
    }
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
