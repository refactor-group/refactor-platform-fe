import axios from "axios";
import { err, ok, type Result } from "neverthrow";
import { useApiSWR } from "@/lib/hooks/use-api-swr";
import { type KeyedMutator } from "swr";
import { siteConfig } from "@/site.config";
import { EntityApi } from "@/lib/api/entity-api";
import { sessionGuard } from "@/lib/auth/session-guard";
import { filenameFromDisposition } from "@/lib/transcript/download-file";
import type { DownloadScope } from "@/lib/transcript/speaker-roles";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";
import {
  parseTranscription,
  parseTranscriptSegment,
  parseTranscriptionWithSpeakers,
  type Speaker,
  type Transcription,
  type TranscriptionWithSpeakers,
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

  /**
   * Names an exact transcription; the session read returns only the latest.
   * None is "no transcription yet", distinct from a failed request, which
   * rejects so SWR can apply the repo's retry policy.
   */
  getWithSpeakers: async (
    sessionId: Id,
    transcriptionId: Id
  ): Promise<Option<TranscriptionWithSpeakers>> => {
    const raw = await EntityApi.getFn<unknown>(
      transcriptionUrl(sessionId, transcriptionId)
    );
    return raw === null ? None : Some(parseTranscriptionWithSpeakers(raw));
  },

  downloadText,
};

function transcriptionUrl(sessionId: Id, transcriptionId: Id): string {
  return `${COACHING_SESSIONS_BASEURL}/${sessionId}/${TRANSCRIPTIONS_PATH}/${transcriptionId}`;
}

/** A transcript file as fetched, ready to hand to the browser. */
export interface TranscriptFile {
  blob: Blob;
  filename: string;
}

/** A failed download, reduced to what the toast layer needs. */
export interface DownloadFailure {
  status: Option<number>;
  slug: Option<string>;
}

const FALLBACK_FILENAME = "transcript.txt";

// Param name and enum spelling are wire format, so not beside DownloadScope.
function speakerParamsFor(scope: DownloadScope): URLSearchParams {
  const params = new URLSearchParams();
  if (scope.kind === "role") params.append("speaker", scope.role);
  return params;
}

/**
 * Fetches the rendered transcript as a file. `Accept` selects the text
 * representation; the same URL returns JSON without it.
 */
async function downloadText(
  sessionId: Id,
  transcriptionId: Id,
  scope: DownloadScope
): Promise<Result<TranscriptFile, DownloadFailure>> {
  const query = speakerParamsFor(scope).toString();
  const url = `${transcriptionUrl(sessionId, transcriptionId)}${query ? `?${query}` : ""}`;

  try {
    const response = await sessionGuard.get<Blob>(url, {
      headers: { Accept: "text/plain" },
      responseType: "blob",
    });
    const filename = filenameFromDisposition(
      response.headers["content-disposition"]
    );
    return ok({
      blob: response.data,
      filename: filename.some ? filename.val : FALLBACK_FILENAME,
    });
  } catch (error) {
    if (!axios.isAxiosError(error) || !error.response) {
      return err({ status: None, slug: None });
    }
    return err({
      status: Some(error.response.status),
      slug: await readErrorSlug(error.response.data),
    });
  }
}

/**
 * Pulls the error slug out of a failed blob request. `responseType: "blob"`
 * applies to errors too, so the JSON envelope arrives as a Blob.
 */
export async function readErrorSlug(data: unknown): Promise<Option<string>> {
  if (!(data instanceof Blob)) return None;
  try {
    const parsed = JSON.parse(await blobToText(data)) as { error?: unknown };
    return typeof parsed.error === "string" ? Some(parsed.error) : None;
  } catch {
    return None; // 401 and 403 are plain text, not JSON
  }
}

// FileReader, not Blob.text(): jsdom implements neither for blobs.
function blobToText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

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

  const { data, error, isLoading, mutate } = useApiSWR<Transcription | null>(
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

  const { data, error, isLoading } = useApiSWR<TranscriptSegment[]>(
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

export interface UseTranscriptionSpeakers {
  speakers: Speaker[];
  /** False while in flight or after a failure, which blocks per-label download. */
  isLoaded: boolean;
}

/**
 * Speakers for the download filter's label-to-role mapping. The single place
 * this data is sourced, so the read can move without touching call sites.
 */
export function useTranscriptionSpeakers(
  sessionId: Id | null,
  transcriptionId: Id | null
): UseTranscriptionSpeakers {
  const url =
    sessionId && transcriptionId
      ? transcriptionUrl(sessionId, transcriptionId)
      : null;

  const { data, error } = useApiSWR<Option<TranscriptionWithSpeakers>>(
    url,
    () => TranscriptionApi.getWithSpeakers(sessionId!, transcriptionId!),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  return {
    speakers: data !== undefined && data.some ? data.val.speakers : [],
    isLoaded: data !== undefined && error === undefined,
  };
}
