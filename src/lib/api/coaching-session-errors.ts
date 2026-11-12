import { organizationArchivedMessage } from "@/lib/api/organization-errors";
import {
  EntityApiError,
  PERMISSION_DENIED_MESSAGE,
  conflictReasonOf,
  isForbiddenError,
} from "@/types/entity-api-error";

export enum SessionWrite {
  Create = "create",
  CreateSeries = "create_series",
  Update = "update",
  RescheduleSeries = "reschedule_series",
}

export type SessionWriteFailure =
  | { kind: "reconnect"; message: string }
  | { kind: "toast"; message: string }
  | { kind: "unexpected" };

function verb(write: SessionWrite): string {
  switch (write) {
    case SessionWrite.Create:
    case SessionWrite.CreateSeries:
      return "create";
    case SessionWrite.Update:
    case SessionWrite.RescheduleSeries:
      return "update";
    default: {
      const _exhaustive: never = write;
      throw new Error(`Unhandled session write: ${_exhaustive}`);
    }
  }
}

function invalidTarget(write: SessionWrite): string {
  return write === SessionWrite.CreateSeries ? "the recurring sessions" : "the session";
}

function toastMessage(error: EntityApiError, write: SessionWrite): string {
  if (error.isNetworkError()) {
    return `Couldn't ${verb(write)} the session · Check your connection and try again`;
  }
  if (error.status === 502) return "Couldn't create the Google Meet link · Try again";
  if (error.status === 422) {
    return `Couldn't ${verb(write)} ${invalidTarget(write)} · Check the details and try again`;
  }
  if (isForbiddenError(error)) return PERMISSION_DENIED_MESSAGE;
  return `Couldn't ${verb(write)} the session · Try again`;
}

/** A 409 refusing a delete or series reschedule because sessions hold notes, actions or agreements. */
export function hasSessionContent(error: unknown): boolean {
  const reason = conflictReasonOf(error);
  return reason.some && reason.val === "sessions_have_content";
}

function hasContentConflict(error: EntityApiError, write: SessionWrite): boolean {
  return write === SessionWrite.RescheduleSeries && hasSessionContent(error);
}

export function sessionWriteFailure(error: unknown, write: SessionWrite): SessionWriteFailure {
  if (!(error instanceof EntityApiError)) return { kind: "unexpected" };
  if (hasContentConflict(error, write)) {
    return { kind: "toast", message: "Some later sessions have notes or actions · Keep enough sessions to cover them" };
  }
  if (error.status === 409 && error.data?.error === "oauth_token_revoked") {
    return { kind: "reconnect", message: "Google Meet is disconnected · Reconnect it in Settings" };
  }
  const archivedMessage = organizationArchivedMessage(error);
  if (archivedMessage !== null) return { kind: "toast", message: archivedMessage };
  return { kind: "toast", message: toastMessage(error, write) };
}
