import axios from "axios";
import { err, ok, type Result } from "neverthrow";
import { useApiSWR } from "@/lib/hooks/use-api-swr";
import { type KeyedMutator } from "swr";
import { siteConfig } from "@/site.config";
import { EntityApi } from "@/lib/api/entity-api";
import { sessionGuard } from "@/lib/auth/session-guard";
import { filenameFromDisposition } from "@/lib/download-file";
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
   * Id-keyed read. Names the exact transcription rather than the session's most
   * recent one, and carries the speakers the download filter maps onto.
   */
  getWithSpeakers: async (
    sessionId: Id,
    transcriptionId: Id
  ): Promise<TranscriptionWithSpeakers | null> => {
    const raw = await EntityApi.getFn<unknown>(
      transcriptionUrl(sessionId, transcriptionId)
    );
    return raw === null ? null : parseTranscriptionWithSpeakers(raw);
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

// The param name and enum spelling are this endpoint's wire format, so they
// live here rather than beside DownloadScope.
function speakerParamsFor(scope: DownloadScope): URLSearchParams {
  const params = new URLSearchParams();
  if (scope.kind === "role") params.append("speaker", scope.role);
  return params;
}

/**
 * Fetches the rendered transcript as a file.
 *
 * Goes through `sessionGuard` so the request inherits credentials, the API
 * version header, and the 401 cleanup interceptor. `Accept` is what selects
 * the text representation over the JSON one.
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
 * Pulls the error slug out of a failed blob request.
 *
 * `responseType: "blob"` applies to error responses too, so the JSON envelope
 * arrives as a Blob and `data.error` is undefined. Without this every slug
 * match silently fails and all errors read as generic.
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

// FileReader rather than Blob.text(): jsdom implements neither that nor
// Response bodies for blobs, and this path has to stay testable.
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
 * Speakers for the download filter's label-to-role mapping.
 *
 * This hook is the seam: if the backend folds `speakers` into the session-level
 * read (board question `transcript_speakers_on_session_level_read`), only the
 * body changes and no call site moves.
 */
export function useTranscriptionSpeakers(
  sessionId: Id | null,
  transcriptionId: Id | null
): UseTranscriptionSpeakers {
  const url =
    sessionId && transcriptionId
      ? transcriptionUrl(sessionId, transcriptionId)
      : null;

  const { data, error } = useApiSWR<TranscriptionWithSpeakers | null>(
    url,
    () => TranscriptionApi.getWithSpeakers(sessionId!, transcriptionId!),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  return {
    speakers: data?.speakers ?? [],
    isLoaded: data !== undefined && error === undefined,
  };
}
