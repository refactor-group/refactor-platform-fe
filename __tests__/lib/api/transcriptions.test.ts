import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

import { TranscriptionApi, readErrorSlug } from "@/lib/api/transcriptions";
import { sessionGuard } from "@/lib/auth/session-guard";
import type { DownloadScope } from "@/lib/utils/transcript-speaker-roles";
import { None, Some } from "@/types/option";
import { SpeakerRole } from "@/types/transcription";

vi.mock("@/lib/auth/session-guard", () => ({
  sessionGuard: { get: vi.fn() },
}));

vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:3000" } },
}));

const URL_BASE = "http://localhost:3000/coaching_sessions/s1/transcriptions/t1";

function okResponse(disposition?: string) {
  return {
    data: new Blob(["transcript"]),
    headers: disposition ? { "content-disposition": disposition } : {},
  };
}

describe("TranscriptionApi.downloadText — request shape", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends Accept: text/plain, which is what selects the file representation", async () => {
    vi.mocked(sessionGuard.get).mockResolvedValue(okResponse() as never);
    await TranscriptionApi.downloadText("s1", "t1", { kind: "all" });

    expect(sessionGuard.get).toHaveBeenCalledWith(
      URL_BASE,
      expect.objectContaining({
        headers: { Accept: "text/plain" },
        responseType: "blob",
      })
    );
  });

  it("sends no speaker param for the unfiltered scope", async () => {
    vi.mocked(sessionGuard.get).mockResolvedValue(okResponse() as never);
    await TranscriptionApi.downloadText("s1", "t1", { kind: "all" });

    expect(vi.mocked(sessionGuard.get).mock.calls[0][0]).toBe(URL_BASE);
  });

  it("sends exactly one speaker param for a role scope", async () => {
    vi.mocked(sessionGuard.get).mockResolvedValue(okResponse() as never);
    const scope: DownloadScope = {
      kind: "role",
      role: SpeakerRole.Coach,
      label: "Jim H",
    };
    await TranscriptionApi.downloadText("s1", "t1", scope);

    expect(vi.mocked(sessionGuard.get).mock.calls[0][0]).toBe(
      `${URL_BASE}?speaker=coach`
    );
  });
});

describe("TranscriptionApi.downloadText — filename", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the server's filename", async () => {
    vi.mocked(sessionGuard.get).mockResolvedValue(
      okResponse('attachment; filename="transcript-2026-09-21.txt"') as never
    );
    const result = await TranscriptionApi.downloadText("s1", "t1", { kind: "all" });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().filename).toBe("transcript-2026-09-21.txt");
  });

  // Happens when the server forgets to expose Content-Disposition via CORS.
  it("falls back to a generic name when the header is not exposed", async () => {
    vi.mocked(sessionGuard.get).mockResolvedValue(okResponse() as never);
    const result = await TranscriptionApi.downloadText("s1", "t1", { kind: "all" });

    expect(result._unsafeUnwrap().filename).toBe("transcript.txt");
  });
});

describe("TranscriptionApi.downloadText — failures", () => {
  beforeEach(() => vi.clearAllMocks());

  function axiosError(status: number, data: unknown) {
    const error = new Error("request failed") as Error & {
      isAxiosError: boolean;
      response: { status: number; data: unknown };
    };
    error.isAxiosError = true;
    error.response = { status, data };
    vi.spyOn(axios, "isAxiosError").mockReturnValue(true);
    return error;
  }

  it("reads the slug out of a blob error body", async () => {
    const body = new Blob([
      JSON.stringify({ error: "speaker_not_identified", status_code: 422 }),
    ]);
    vi.mocked(sessionGuard.get).mockRejectedValue(axiosError(422, body));

    const result = await TranscriptionApi.downloadText("s1", "t1", { kind: "all" });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({
      status: Some(422),
      slug: Some("speaker_not_identified"),
    });
  });

  it("reports a status with no slug for plain-text failures like 403", async () => {
    vi.mocked(sessionGuard.get).mockRejectedValue(
      axiosError(403, new Blob(["FORBIDDEN"]))
    );
    const result = await TranscriptionApi.downloadText("s1", "t1", { kind: "all" });

    expect(result._unsafeUnwrapErr()).toEqual({ status: Some(403), slug: None });
  });

  it("reports nothing identifiable for a network failure", async () => {
    vi.spyOn(axios, "isAxiosError").mockReturnValue(false);
    vi.mocked(sessionGuard.get).mockRejectedValue(new Error("offline"));

    const result = await TranscriptionApi.downloadText("s1", "t1", { kind: "all" });

    expect(result._unsafeUnwrapErr()).toEqual({ status: None, slug: None });
  });
});

describe("TranscriptionApi.getWithSpeakers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns None when the session has no transcription yet", async () => {
    vi.mocked(sessionGuard.get).mockResolvedValue({ data: { data: null } } as never);
    await expect(TranscriptionApi.getWithSpeakers("s1", "t1")).resolves.toEqual(None);
  });

  it("returns Some with the parsed speakers", async () => {
    vi.mocked(sessionGuard.get).mockResolvedValue({
      data: {
        data: {
          id: "t1",
          coaching_session_id: "s1",
          meeting_recording_id: "r1",
          external_id: "x1",
          status: "completed",
          created_at: "2026-09-21T10:00:00Z",
          updated_at: "2026-09-21T10:00:00Z",
          speakers: [{ label: "Jim H", role: "coach" }],
        },
      },
    } as never);

    const result = await TranscriptionApi.getWithSpeakers("s1", "t1");
    expect(result.some && result.val.speakers).toEqual([
      { label: "Jim H", role: Some(SpeakerRole.Coach) },
    ]);
  });

  // Rejecting rather than returning an Err is deliberate: SWR only applies the
  // repo's fail-fast retry policy to a fetcher that throws.
  it("rejects on a transport failure rather than resolving", async () => {
    vi.mocked(sessionGuard.get).mockRejectedValue(new Error("boom"));
    await expect(TranscriptionApi.getWithSpeakers("s1", "t1")).rejects.toThrow();
  });
});

describe("readErrorSlug", () => {
  it("returns None for a non-blob body", async () => {
    await expect(readErrorSlug({ error: "nope" })).resolves.toEqual(None);
  });

  it("returns None for a blob that is not JSON", async () => {
    await expect(readErrorSlug(new Blob(["UNAUTHORIZED"]))).resolves.toEqual(None);
  });

  it("returns None for JSON with no error slug", async () => {
    await expect(
      readErrorSlug(new Blob([JSON.stringify({ message: "boom" })]))
    ).resolves.toEqual(None);
  });
});
