import { describe, expect, it } from "vitest";
import { SessionWrite, sessionWriteFailure } from "@/lib/api/coaching-session-errors";
import { EntityApiError } from "@/types/entity-api-error";

function apiError(status: number, data: unknown = {}): EntityApiError {
  const axiosLike = Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: { status, statusText: "Error", data },
  });
  return new EntityApiError("POST", "/coaching_session_series/s-1/reschedule", axiosLike);
}

const CONTENT_CONFLICT = {
  error: "conflict",
  details: { reason: "sessions_have_content", coaching_session_ids: ["s-9"] },
};

describe("sessionWriteFailure: rescheduling a series", () => {
  it("explains later sessions that have content", () => {
    expect(sessionWriteFailure(apiError(409, CONTENT_CONFLICT), SessionWrite.RescheduleSeries)).toEqual({
      kind: "toast",
      message: "Some later sessions have notes or actions · Keep enough sessions to cover them",
    });
  });

  it("reads other failures as an update", () => {
    expect(sessionWriteFailure(apiError(422, { error: "validation_error" }), SessionWrite.RescheduleSeries)).toEqual({
      kind: "toast",
      message: "Couldn't update the session · Check the details and try again",
    });
    expect(sessionWriteFailure(apiError(409, { error: "conflict" }), SessionWrite.RescheduleSeries)).toEqual({
      kind: "toast",
      message: "Couldn't update the session · Try again",
    });
  });

  it("keeps the content conflict to series reschedules", () => {
    expect(sessionWriteFailure(apiError(409, CONTENT_CONFLICT), SessionWrite.Update)).toEqual({
      kind: "toast",
      message: "Couldn't update the session · Try again",
    });
  });
});
