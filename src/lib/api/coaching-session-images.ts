import axios from "axios";
import { err, ok, type Result } from "neverthrow";
import { siteConfig } from "@/site.config";
import { sessionGuard } from "@/lib/auth/session-guard";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";
import {
  parseCoachingSessionImage,
  type CoachingSessionImage,
} from "@/types/coaching-session-image";

const COACHING_SESSIONS_BASEURL = `${siteConfig.env.backendServiceURL}/coaching_sessions`;
const IMAGES_BASEURL = `${siteConfig.env.backendServiceURL}/coaching_session_images`;

// An upload can take far longer than the shared client's 15 s default.
const UPLOAD_TIMEOUT_MS = 120000;

export enum UploadFailureKind {
  TooLarge = "too_large",
  UnsupportedType = "unsupported_type",
  StorageUnavailable = "storage_unavailable",
  Forbidden = "forbidden",
  Network = "network",
  Unknown = "unknown",
}

export interface UploadFailure {
  kind: UploadFailureKind;
  status: Option<number>;
}

function failureKindFor(status: number): UploadFailureKind {
  switch (status) {
    case 413:
      return UploadFailureKind.TooLarge;
    case 415:
      return UploadFailureKind.UnsupportedType;
    case 503:
      return UploadFailureKind.StorageUnavailable;
    case 401:
    case 403:
    case 404:
      return UploadFailureKind.Forbidden;
    default:
      return UploadFailureKind.Unknown;
  }
}

async function upload(
  sessionId: Id,
  file: File,
  onProgress?: (fraction: number) => void
): Promise<Result<CoachingSessionImage, UploadFailure>> {
  const body = new FormData();
  body.append("file", file);

  let payload: unknown;
  let status: number;
  try {
    // No Content-Type here: axios derives the multipart boundary itself.
    const response = await sessionGuard.post(
      `${COACHING_SESSIONS_BASEURL}/${sessionId}/images`,
      body,
      {
        timeout: UPLOAD_TIMEOUT_MS,
        onUploadProgress: (event) => {
          if (!onProgress || !event.total) return;
          onProgress(event.loaded / event.total);
        },
      }
    );
    payload = response.data?.data;
    status = response.status;
  } catch (error) {
    if (!axios.isAxiosError(error) || !error.response) {
      return err({ kind: UploadFailureKind.Network, status: None });
    }
    return err({
      kind: failureKindFor(error.response.status),
      status: Some(error.response.status),
    });
  }
  // A success the client cannot read is still a failure the caller must see,
  // so it stays inside the Result rather than throwing past the signature.
  try {
    return ok(parseCoachingSessionImage(payload));
  } catch {
    return err({ kind: UploadFailureKind.Unknown, status: Some(status) });
  }
}

export const CoachingSessionImageApi = {
  upload,

  /** Stable URL for an image node's `src`, resolved at render time. */
  imageUrl: (imageId: Id): string => `${IMAGES_BASEURL}/${imageId}`,
};
