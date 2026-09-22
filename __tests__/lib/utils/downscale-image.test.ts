import { describe, it, expect, afterEach, vi } from "vitest";

import {
  downscaleImage,
  validateImageFile,
  ImageRejectionKind,
  MAX_IMAGE_EDGE_PX,
} from "@/lib/utils/downscale-image";

const MAX_BYTES = 10 * 1024 * 1024;

function fileOfSize(type: string, bytes: number, name = "image"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("validateImageFile", () => {
  it("accepts a small PNG", () => {
    const file = fileOfSize("image/png", 1024, "shot.png");

    const result = validateImageFile(file, MAX_BYTES);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(file);
  });

  it("rejects SVG as an unsupported type", () => {
    const file = fileOfSize("image/svg+xml", 64, "vector.svg");

    expect(validateImageFile(file, MAX_BYTES)._unsafeUnwrapErr()).toBe(
      ImageRejectionKind.UnsupportedType
    );
  });

  it("rejects a file over the cap", () => {
    const file = fileOfSize("image/png", 2048, "big.png");

    expect(validateImageFile(file, 1024)._unsafeUnwrapErr()).toBe(
      ImageRejectionKind.TooLarge
    );
  });
});

// Stand in for the browser APIs jsdom lacks, so the re-encode path actually
// runs and the GIF passthrough is what the assertion below measures.
function stubEncodingEnvironment() {
  vi.stubGlobal("createImageBitmap", async () => ({
    width: 4000,
    height: 1000,
    close: () => undefined,
  }));
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: () => undefined }),
    toBlob: (callback: (blob: Blob) => void) =>
      callback(new Blob([new Uint8Array(16)], { type: "image/webp" })),
  };
  vi.spyOn(document, "createElement").mockReturnValue(
    canvas as unknown as HTMLElement
  );
}

describe("downscaleImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("passes a GIF through untouched so animation survives", async () => {
    stubEncodingEnvironment();
    const gif = fileOfSize("image/gif", 4096, "animated.gif");

    expect(await downscaleImage(gif)).toBe(gif);
  });

  it("re-encodes an oversized PNG to a smaller WebP", async () => {
    stubEncodingEnvironment();
    const png = fileOfSize("image/png", 4096, "shot.png");

    const result = await downscaleImage(png);

    expect(result).not.toBe(png);
    expect(result.type).toBe("image/webp");
    expect(result.name).toBe("shot.webp");
  });

  it("keeps the original when re-encoding would grow the file", async () => {
    stubEncodingEnvironment();
    const png = fileOfSize("image/png", 8, "small.png");

    expect(await downscaleImage(png)).toBe(png);
  });

  it("returns the original when canvas encoding is unavailable", async () => {
    const png = fileOfSize("image/png", 4096, "shot.png");

    expect(await downscaleImage(png)).toBe(png);
  });
});

describe("MAX_IMAGE_EDGE_PX", () => {
  it("caps the long edge", () => {
    expect(MAX_IMAGE_EDGE_PX).toBe(2000);
  });
});
