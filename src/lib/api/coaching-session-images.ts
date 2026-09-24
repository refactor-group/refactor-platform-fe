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

/**
 * One path segment, escaped.
 *
 * Image ids come from the note document, and a pasted `data-image-id` of `../../users/x`
 * would otherwise be normalised by the browser into a credentialed request against a
 * completely different endpoint. Callers should reject a non-UUID id long before here;
 * this is the backstop that makes an id incapable of leaving the images collection
 * whatever slipped through.
 */
const imageSegment = (imageId: Id): string => encodeURIComponent(imageId);

export enum UploadFailureKind {
  TooLarge = "too_large",
  UnsupportedType = "unsupported_type",
  StorageUnavailable = "storage_unavailable",
  Forbidden = "forbidden",
  NotFound = "not_found",
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
      return UploadFailureKind.Forbidden;
    // Kept apart from Forbidden: a missing session is not a permissions problem, and
    // telling the coach they lack permission would be the wrong story entirely.
    case 404:
      return UploadFailureKind.NotFound;
    default:
      return UploadFailureKind.Unknown;
  }
}

function toUploadFailure(error: unknown): UploadFailure {
  if (!axios.isAxiosError(error) || !error.response) {
    return { kind: UploadFailureKind.Network, status: None };
  }
  return {
    kind: failureKindFor(error.response.status),
    status: Some(error.response.status),
  };
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
    return err(toUploadFailure(error));
  }
  // A success the client cannot read is still a failure the caller must see,
  // so it stays inside the Result rather than throwing past the signature.
  try {
    return ok(parseCoachingSessionImage(payload));
  } catch {
    return err({ kind: UploadFailureKind.Unknown, status: Some(status) });
  }
}

async function markDeleted(imageId: Id): Promise<Result<void, UploadFailure>> {
  try {
    await sessionGuard.delete(`${IMAGES_BASEURL}/${imageSegment(imageId)}`);
    return ok(undefined);
  } catch (error) {
    return err(toUploadFailure(error));
  }
}

async function restore(imageId: Id): Promise<Result<void, UploadFailure>> {
  try {
    await sessionGuard.post(`${IMAGES_BASEURL}/${imageSegment(imageId)}/restore`);
    return ok(undefined);
  } catch (error) {
    return err(toUploadFailure(error));
  }
}

export const CoachingSessionImageApi = {
  upload,

  /**
   * Best-effort signal that an image left a note. The backend defers
   * destruction, so a lost signal leaks one row rather than breaking undo.
   */
  markDeleted,

  /** Undo counterpart of {@link markDeleted}; also best-effort. */
  restore,

  /** Stable URL for an image node's `src`, resolved at render time. */
  imageUrl: (imageId: Id): string => `${IMAGES_BASEURL}/${imageSegment(imageId)}`,
};
