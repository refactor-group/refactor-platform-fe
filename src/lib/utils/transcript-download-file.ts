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
  // Deferred: revoking in the same tick races the browser's read of the URL.
  // Chrome reads it during click(), Firefox and Safari have not always.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Reads the filename out of a `Content-Disposition` header.
 *
 * Returns None when the header is absent, which cross-origin responses do
 * unless the server lists it in `Access-Control-Expose-Headers`.
 */
export function filenameFromDisposition(header: unknown): Option<string> {
  if (typeof header !== "string") return None;

  // RFC 5987 `filename*` is percent-encoded, so it needs decoding. Checked
  // first because a header carrying both forms should prefer this one.
  const encoded = /filename\*=(?:UTF-8'')?"?([^";]+)"?/i.exec(header)?.[1]?.trim();
  if (encoded) return Some(decodeSafely(encoded));

  // Plain `filename` is literal. Decoding it would throw on a bare `%` and
  // turn a 200 with a blob in hand into a failure toast.
  const plain = /filename="?([^";]+)"?/i.exec(header)?.[1]?.trim();
  return plain ? Some(plain) : None;
}

function decodeSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // malformed encoding beats no filename at all
  }
}
