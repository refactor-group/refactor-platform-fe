import { None, Some, type Option } from "@/types/option";

/** Triggers a browser download for an already-fetched blob. */
export function saveBlobAs(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Reads the filename out of a `Content-Disposition` header.
 *
 * Returns None when the header is absent, which cross-origin responses do
 * unless the server lists it in `Access-Control-Expose-Headers`.
 */
export function filenameFromDisposition(header: unknown): Option<string> {
  if (typeof header !== "string") return None;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  const filename = match?.[1]?.trim();
  return filename ? Some(decodeURIComponent(filename)) : None;
}
