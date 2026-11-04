import { describe, expect, it } from "vitest";
import { SessionWrite, sessionWriteFailure } from "@/lib/api/coaching-session-errors";
import { EntityApiError, PERMISSION_DENIED_MESSAGE } from "@/types/entity-api-error";

function apiError(status: number, data: unknown = {}): EntityApiError {
  const axiosLike = Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: { status, statusText: "Error", data },
  });
  return new EntityApiError("POST", "/coaching_sessions", axiosLike);
}

function networkError(): EntityApiError {
  return new EntityApiError("POST", "/coaching_sessions", Object.assign(new Error("Network Error"), { isAxiosError: true }));
}

const toast = (message: string) => ({ kind: "toast", message });

describe("sessionWriteFailure", () => {
  it("leaves errors that aren't API errors to the caller", () => {
    expect(sessionWriteFailure(new Error("boom"), SessionWrite.Create)).toEqual({ kind: "unexpected" });
  });

  it("sends a revoked Google connection to Settings", () => {
    expect(sessionWriteFailure(apiError(409, { error: "oauth_token_revoked" }), SessionWrite.Create)).toEqual({
      kind: "reconnect",
      message: "Google Meet is disconnected · Reconnect it in Settings",
    });
  });

  it("explains an archived organization", () => {
    expect(sessionWriteFailure(apiError(409, { error: "organization_archived" }), SessionWrite.Update)).toEqual(
      toast("This organization is archived · It can't be changed")
    );
  });

  it("asks to check the connection when offline", () => {
    expect(sessionWriteFailure(networkError(), SessionWrite.Create)).toEqual(
      toast("Couldn't create the session · Check your connection and try again")
    );
    expect(sessionWriteFailure(networkError(), SessionWrite.Update)).toEqual(
      toast("Couldn't update the session · Check your connection and try again")
    );
  });

  it("names a failed meeting link", () => {
    expect(sessionWriteFailure(apiError(502), SessionWrite.Create)).toEqual(
      toast("Couldn't create the Google Meet link · Try again")
    );
  });

  it("asks to check the details on a validation error", () => {
    expect(sessionWriteFailure(apiError(422), SessionWrite.Create)).toEqual(
      toast("Couldn't create the session · Check the details and try again")
    );
    expect(sessionWriteFailure(apiError(422), SessionWrite.CreateSeries)).toEqual(
      toast("Couldn't create the recurring sessions · Check the details and try again")
    );
    expect(sessionWriteFailure(apiError(422), SessionWrite.Update)).toEqual(
      toast("Couldn't update the session · Check the details and try again")
    );
  });

  it("says when permission is missing", () => {
    expect(sessionWriteFailure(apiError(403), SessionWrite.Create)).toEqual(toast(PERMISSION_DENIED_MESSAGE));
  });

  it("falls back to a retry message", () => {
    expect(sessionWriteFailure(apiError(500), SessionWrite.CreateSeries)).toEqual(
      toast("Couldn't create the coaching session · Try again")
    );
    expect(sessionWriteFailure(apiError(500), SessionWrite.Update)).toEqual(
      toast("Couldn't update the coaching session · Try again")
    );
  });
});
