import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { filenameFromDisposition, saveBlobAs } from "@/lib/utils/transcript-download-file";
import { None, Some } from "@/types/option";

describe("filenameFromDisposition", () => {
  it("reads a quoted filename", () => {
    expect(
      filenameFromDisposition('attachment; filename="transcript-2026-09-21.txt"')
    ).toEqual(Some("transcript-2026-09-21.txt"));
  });

  it("reads an unquoted filename", () => {
    expect(
      filenameFromDisposition("attachment; filename=transcript.txt")
    ).toEqual(Some("transcript.txt"));
  });

  it("reads the -filtered variant the backend sends for a speaker filter", () => {
    expect(
      filenameFromDisposition(
        'attachment; filename="transcript-2026-09-21-filtered.txt"'
      )
    ).toEqual(Some("transcript-2026-09-21-filtered.txt"));
  });

  // The header is invisible to cross-origin JS unless the server exposes it,
  // so absent is the realistic failure, not malformed.
  it("returns None when the header is missing", () => {
    expect(filenameFromDisposition(undefined)).toEqual(None);
    expect(filenameFromDisposition(null)).toEqual(None);
  });

  it("returns None when the header carries no filename", () => {
    expect(filenameFromDisposition("attachment")).toEqual(None);
  });

  // A plain `filename` is literal. Decoding it would throw URIError on a bare
  // `%`, which bubbles out of the download and shows a failure toast for a
  // response that actually succeeded.
  it("does not decode the plain form, so a bare percent cannot throw", () => {
    expect(
      filenameFromDisposition('attachment; filename="100% transcript.txt"')
    ).toEqual(Some("100% transcript.txt"));
  });

  it("decodes the RFC 5987 form, which is percent-encoded", () => {
    expect(
      filenameFromDisposition("attachment; filename*=UTF-8''transcript%20a%2Bb.txt")
    ).toEqual(Some("transcript a+b.txt"));
  });

  it("falls back to the raw value when the encoded form is malformed", () => {
    expect(
      filenameFromDisposition("attachment; filename*=UTF-8''bad%ZZ.txt")
    ).toEqual(Some("bad%ZZ.txt"));
  });

  it("prefers the encoded form when the header carries both", () => {
    expect(
      filenameFromDisposition(
        'attachment; filename="fallback.txt"; filename*=UTF-8\'\'real%20name.txt'
      )
    ).toEqual(Some("real name.txt"));
  });
});

describe("saveBlobAs", () => {
  const createObjectURL = vi.fn(() => "blob:fake");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("clicks an anchor carrying the filename, then cleans up", async () => {
    const click = vi.fn();
    const anchor = document.createElement("a");
    anchor.click = click;
    vi.spyOn(document, "createElement").mockReturnValueOnce(anchor);

    saveBlobAs(new Blob(["hello"]), "transcript.txt");

    expect(anchor.getAttribute("download")).toBe("transcript.txt");
    expect(anchor.href).toContain("blob:fake");
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.body.contains(anchor)).toBe(false);

    // Deferred by a tick: revoking synchronously races the browser's read of
    // the object URL, which some browsers lose.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake")
    );
  });
});
