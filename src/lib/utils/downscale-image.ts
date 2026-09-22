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

/** Validate a picked/pasted/dropped file before it reaches the network. */
export function validateImageFile(
  file: File,
  maxBytes: number
): Result<File, ImageRejectionKind> {
  if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type as AcceptedImageMimeType)) {
    return err(ImageRejectionKind.UnsupportedType);
  }
  if (file.size > maxBytes) {
    return err(ImageRejectionKind.TooLarge);
  }
  return ok(file);
}

/**
 * Re-encode to at most MAX_IMAGE_EDGE_PX on the long edge. Returns the original
 * file unchanged when it is already small enough, when it is a GIF, or when
 * canvas encoding is unavailable or fails.
 */
export async function downscaleImage(file: File): Promise<File> {
  // Canvas re-encoding flattens an animated GIF to its first frame.
  if (file.type === ANIMATED_MIME_TYPE) return file;
  if (!canEncodeInThisEnvironment()) return file;

  try {
    const source = await createImageBitmap(file);
    const size = scaledSize(source.width, source.height);
    if (!size.some) {
      source.close();
      return file;
    }

    const blob = await encodeToWebP(source, size.val);
    source.close();
    if (!blob.some || blob.val.size >= file.size) return file;

    return new File([blob.val], webPFilename(file.name), {
      type: OUTPUT_MIME_TYPE,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
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
