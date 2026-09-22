import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { filenameFromDisposition, saveBlobAs } from "@/lib/download-file";
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

  it("clicks an anchor carrying the filename, then cleans up", () => {
    const click = vi.fn();
    const anchor = document.createElement("a");
    anchor.click = click;
    vi.spyOn(document, "createElement").mockReturnValueOnce(anchor);

    saveBlobAs(new Blob(["hello"]), "transcript.txt");

    expect(anchor.getAttribute("download")).toBe("transcript.txt");
    expect(anchor.href).toContain("blob:fake");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    expect(document.body.contains(anchor)).toBe(false);
  });
});
