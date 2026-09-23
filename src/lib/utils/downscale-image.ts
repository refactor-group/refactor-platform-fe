import { err, ok, type Result } from "neverthrow";
import { None, Some, type Option } from "@/types/option";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  type AcceptedImageMimeType,
} from "@/types/coaching-session-image";

export const MAX_IMAGE_EDGE_PX = 2000;

const OUTPUT_MIME_TYPE = "image/webp";
const OUTPUT_QUALITY = 0.82;
const OUTPUT_EXTENSION = "webp";
const ANIMATED_MIME_TYPE = "image/gif";

export enum ImageRejectionKind {
  UnsupportedType = "unsupported_type",
  TooLarge = "too_large",
}

/**
 * How far past the upload cap we will still try to decode. A phone photo routinely
 * exceeds the cap and downscales well under it, so the cap belongs after downscaling.
 * Decoding costs memory in proportion to pixel count, though, so something this far
 * out is refused unread rather than decoded on the chance it shrinks enough.
 */
export const DECODE_CEILING_MULTIPLIER = 4;

/**
 * Accept a picked/pasted/dropped file for processing: a kind we can handle, and small
 * enough to be worth decoding. The upload cap itself is applied by `enforceUploadSize`
 * once downscaling has had its chance.
 */
export function acceptImageFile(
  file: File,
  maxBytes: number
): Result<File, ImageRejectionKind> {
  if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type as AcceptedImageMimeType)) {
    return err(ImageRejectionKind.UnsupportedType);
  }
  if (file.size > maxBytes * DECODE_CEILING_MULTIPLIER) {
    return err(ImageRejectionKind.TooLarge);
  }
  return ok(file);
}

/** The upload cap, applied to whatever downscaling actually produced. */
export function enforceUploadSize(
  file: File,
  maxBytes: number
): Result<File, ImageRejectionKind> {
  return file.size > maxBytes ? err(ImageRejectionKind.TooLarge) : ok(file);
}

/**
 * Re-encode to at most MAX_IMAGE_EDGE_PX on the long edge. Given `maxBytes`, also
 * re-encodes a file that is within those dimensions but over the byte cap, since a
 * modestly sized photo can still be far too heavy as PNG. Returns the original file
 * unchanged when there is nothing to gain, when it is a GIF, or when canvas encoding
 * is unavailable or fails.
 */
export async function downscaleImage(
  file: File,
  maxBytes?: number
): Promise<File> {
  // Canvas re-encoding flattens an animated GIF to its first frame.
  if (file.type === ANIMATED_MIME_TYPE) return file;
  if (!canEncodeInThisEnvironment()) return file;

  let source: ImageBitmap;
  try {
    source = await createImageBitmap(file);
  } catch {
    return file;
  }

  // Closed on every path, including an encode that throws. A decoded bitmap holds the
  // full-size pixels natively, and one leaked per failed attempt adds up fast.
  try {
    return await reencode(file, source, maxBytes);
  } catch {
    return file;
  } finally {
    source.close();
  }
}

async function reencode(
  file: File,
  source: ImageBitmap,
  maxBytes: number | undefined
): Promise<File> {
  const size = scaledSize(source.width, source.height);
  const overCap = maxBytes !== undefined && file.size > maxBytes;
  if (!size.some && !overCap) return file;

  const target = size.some
    ? size.val
    : { width: source.width, height: source.height };
  const blob = await encodeToWebP(source, target);
  // Keeping the original when re-encoding does not shrink it means an oversized image
  // can come back still oversized, so the long-edge ceiling is a target rather than a
  // guarantee. Deliberate: a file that grows when re-encoded is already atypical, and
  // sending more bytes to enforce a pixel bound helps nobody. `enforceUploadSize` is
  // what actually holds, and it holds on bytes.
  if (!blob.some || blob.val.size >= file.size) return file;

  return new File([blob.val], webPFilename(file.name), {
    type: OUTPUT_MIME_TYPE,
    lastModified: file.lastModified,
  });
}

function canEncodeInThisEnvironment(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof createImageBitmap === "function"
  );
}

interface ScaledSize {
  width: number;
  height: number;
}

function scaledSize(width: number, height: number): Option<ScaledSize> {
  const longEdge = Math.max(width, height);
  if (longEdge <= MAX_IMAGE_EDGE_PX || longEdge === 0) return None;
  const ratio = MAX_IMAGE_EDGE_PX / longEdge;
  return Some({
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  });
}

function encodeToWebP(
  image: CanvasImageSource,
  size: ScaledSize
): Promise<Option<Blob>> {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.toBlob !== "function") {
    return Promise.resolve(None);
  }
  context.drawImage(image, 0, 0, size.width, size.height);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? Some(blob) : None),
      OUTPUT_MIME_TYPE,
      OUTPUT_QUALITY
    );
  });
}

function webPFilename(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base || "image"}.${OUTPUT_EXTENSION}`;
}
