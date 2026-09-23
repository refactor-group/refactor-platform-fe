import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError } from "axios";

import {
  CoachingSessionImageApi,
  UploadFailureKind,
} from "@/lib/api/coaching-session-images";
import { sessionGuard } from "@/lib/auth/session-guard";

vi.mock("@/lib/auth/session-guard", () => ({
  sessionGuard: { post: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:4000" } },
}));

const UPLOAD_URL = "http://localhost:4000/coaching_sessions/cs-1/images";

const imagePayload = {
  id: "img-1",
  coaching_session_id: "cs-1",
  mime_type: "image/png",
  byte_size: 2048,
  width: 1024,
  height: 768,
  created_at: "2026-09-22T10:00:00Z",
};

function pngFile(): File {
  return new File(["bytes"], "shot.png", { type: "image/png" });
}

function createdResponse() {
  return { status: 201, data: { status_code: 201, data: imagePayload } };
}

function responseError(status: number) {
  const error = new AxiosError("request failed");
  error.response = {
    status,
    statusText: "",
    headers: {},
    config: {} as never,
    data: {},
  };
  return error;
}

describe("CoachingSessionImageApi.upload — request shape", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts multipart FormData to the session-scoped images URL", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue(createdResponse() as never);
    const file = pngFile();

    await CoachingSessionImageApi.upload("cs-1", file);

    const [url, body] = vi.mocked(sessionGuard.post).mock.calls[0];
    expect(url).toBe(UPLOAD_URL);
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBe(file);
  });

  it("sets no explicit Content-Type, leaving the boundary to axios", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue(createdResponse() as never);

    await CoachingSessionImageApi.upload("cs-1", pngFile());

    const config = vi.mocked(sessionGuard.post).mock.calls[0][2] as
      | { headers?: Record<string, unknown> }
      | undefined;
    expect(config?.headers).toBeUndefined();
  });

  it("uses a per-request upload timeout", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue(createdResponse() as never);

    await CoachingSessionImageApi.upload("cs-1", pngFile());

    const config = vi.mocked(sessionGuard.post).mock.calls[0][2] as {
      timeout: number;
    };
    expect(config.timeout).toBe(120000);
  });

  it("reports progress as a 0..1 fraction", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue(createdResponse() as never);
    const onProgress = vi.fn();

    await CoachingSessionImageApi.upload("cs-1", pngFile(), onProgress);

    const config = vi.mocked(sessionGuard.post).mock.calls[0][2] as {
      onUploadProgress: (event: { loaded: number; total?: number }) => void;
    };
    config.onUploadProgress({ loaded: 50, total: 200 });
    expect(onProgress).toHaveBeenCalledWith(0.25);
  });

  it("stays silent when the browser reports no total", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue(createdResponse() as never);
    const onProgress = vi.fn();

    await CoachingSessionImageApi.upload("cs-1", pngFile(), onProgress);

    const config = vi.mocked(sessionGuard.post).mock.calls[0][2] as {
      onUploadProgress: (event: { loaded: number; total?: number }) => void;
    };
    config.onUploadProgress({ loaded: 50 });
    expect(onProgress).not.toHaveBeenCalled();
  });
});

describe("CoachingSessionImageApi.upload — outcomes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the parsed image on success", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue(createdResponse() as never);

    const result = await CoachingSessionImageApi.upload("cs-1", pngFile());

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toMatchObject({
      id: "img-1",
      coaching_session_id: "cs-1",
      mime_type: "image/png",
      byte_size: 2048,
    });
    expect(result._unsafeUnwrap().width.some).toBe(true);
  });

  it("resolves to Unknown when a success payload cannot be parsed", async () => {
    const { id: _id, ...withoutId } = imagePayload;
    vi.mocked(sessionGuard.post).mockResolvedValue({
      status: 201,
      data: { status_code: 201, data: withoutId },
    } as never);

    const result = await CoachingSessionImageApi.upload("cs-1", pngFile());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe(UploadFailureKind.Unknown);
    expect(result._unsafeUnwrapErr().status).toEqual({
      some: true,
      none: false,
      val: 201,
    });
  });

  it("does not reject on an unparseable success payload", async () => {
    const { id: _id, ...withoutId } = imagePayload;
    vi.mocked(sessionGuard.post).mockResolvedValue({
      status: 201,
      data: { status_code: 201, data: withoutId },
    } as never);

    await expect(
      CoachingSessionImageApi.upload("cs-1", pngFile())
    ).resolves.toBeDefined();
  });

  it("maps 413 to TooLarge", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(responseError(413));

    const result = await CoachingSessionImageApi.upload("cs-1", pngFile());

    expect(result._unsafeUnwrapErr().kind).toBe(UploadFailureKind.TooLarge);
    expect(result._unsafeUnwrapErr().status).toEqual({
      some: true,
      none: false,
      val: 413,
    });
  });

  it("maps 415 to UnsupportedType", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(responseError(415));

    const result = await CoachingSessionImageApi.upload("cs-1", pngFile());

    expect(result._unsafeUnwrapErr().kind).toBe(
      UploadFailureKind.UnsupportedType
    );
  });

  it("maps 503 to StorageUnavailable", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(responseError(503));

    const result = await CoachingSessionImageApi.upload("cs-1", pngFile());

    expect(result._unsafeUnwrapErr().kind).toBe(
      UploadFailureKind.StorageUnavailable
    );
  });

  it("maps 403 to Forbidden", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(responseError(403));

    const result = await CoachingSessionImageApi.upload("cs-1", pngFile());

    expect(result._unsafeUnwrapErr().kind).toBe(UploadFailureKind.Forbidden);
  });

  it("maps an unrecognized status to Unknown", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(responseError(500));

    const result = await CoachingSessionImageApi.upload("cs-1", pngFile());

    expect(result._unsafeUnwrapErr().kind).toBe(UploadFailureKind.Unknown);
  });

  it("maps a responseless rejection to Network with no status", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(
      new AxiosError("Network Error")
    );

    const result = await CoachingSessionImageApi.upload("cs-1", pngFile());

    expect(result._unsafeUnwrapErr().kind).toBe(UploadFailureKind.Network);
    expect(result._unsafeUnwrapErr().status.none).toBe(true);
  });
});

describe("CoachingSessionImageApi removal signals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks an image deleted at the image-scoped URL", async () => {
    vi.mocked(sessionGuard.delete).mockResolvedValue({ status: 200 } as never);

    const result = await CoachingSessionImageApi.markDeleted("img-1");

    expect(vi.mocked(sessionGuard.delete).mock.calls[0][0]).toBe(
      "http://localhost:4000/coaching_session_images/img-1"
    );
    expect(result.isOk()).toBe(true);
  });

  it("restores an image at the restore URL", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue({ status: 200 } as never);

    const result = await CoachingSessionImageApi.restore("img-1");

    expect(vi.mocked(sessionGuard.post).mock.calls[0][0]).toBe(
      "http://localhost:4000/coaching_session_images/img-1/restore"
    );
    expect(result.isOk()).toBe(true);
  });

  it("resolves to err rather than rejecting when marking deleted fails", async () => {
    vi.mocked(sessionGuard.delete).mockRejectedValue(responseError(403));

    const result = await CoachingSessionImageApi.markDeleted("img-1");

    expect(result._unsafeUnwrapErr().kind).toBe(UploadFailureKind.Forbidden);
  });

  it("resolves to err rather than rejecting when restoring fails", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(
      new AxiosError("Network Error")
    );

    const result = await CoachingSessionImageApi.restore("img-1");

    expect(result._unsafeUnwrapErr().kind).toBe(UploadFailureKind.Network);
    expect(result._unsafeUnwrapErr().status.none).toBe(true);
  });
});

describe("CoachingSessionImageApi.imageUrl", () => {
  it("is image-scoped, not session-scoped", () => {
    expect(CoachingSessionImageApi.imageUrl("img-1")).toBe(
      "http://localhost:4000/coaching_session_images/img-1"
    );
  });
});

describe("image id escaping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Image ids come from the note document. A pasted data-image-id of "../../users/x"
  // is normalised by the browser into a credentialed request against an unrelated
  // endpoint, so the id must never survive as raw path syntax.
  const TRAVERSAL = "../../users/89c7a48d";

  it("escapes a traversal id in the delete path", async () => {
    vi.mocked(sessionGuard.delete).mockResolvedValue({ data: {} } as never);

    await CoachingSessionImageApi.markDeleted(TRAVERSAL);

    const [url] = vi.mocked(sessionGuard.delete).mock.calls[0];
    expect(url).not.toContain("../");
    expect(new URL(url as string).pathname).toBe(
      "/coaching_session_images/..%2F..%2Fusers%2F89c7a48d"
    );
  });

  it("escapes a traversal id in the restore path", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue({ data: {} } as never);

    await CoachingSessionImageApi.restore(TRAVERSAL);

    const [url] = vi.mocked(sessionGuard.post).mock.calls[0];
    expect(url).not.toContain("../");
    expect(new URL(url as string).pathname.startsWith("/coaching_session_images/")).toBe(
      true
    );
  });

  it("escapes a traversal id in the image url", () => {
    const url = CoachingSessionImageApi.imageUrl(TRAVERSAL);

    expect(url).not.toContain("../");
    expect(new URL(url).pathname.startsWith("/coaching_session_images/")).toBe(true);
  });

  it("leaves a normal uuid readable", () => {
    const id = "11111111-1111-4111-8111-111111111111";

    expect(CoachingSessionImageApi.imageUrl(id)).toBe(
      `http://localhost:4000/coaching_session_images/${id}`
    );
  });
});

describe("failure mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A missing session is not a permissions problem; telling the coach they lack
  // permission sends them looking for the wrong thing entirely.
  it("maps 404 to NotFound, not Forbidden", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(responseError(404));

    const result = await CoachingSessionImageApi.upload("cs-1", pngFile());

    expect(result._unsafeUnwrapErr().kind).toBe(UploadFailureKind.NotFound);
  });
});
