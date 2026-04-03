/**
 * Builds a URL query string from a params object, omitting undefined/null values.
 *
 * @param params Key-value pairs to encode as query parameters
 * @returns A query string prefixed with "?" or an empty string if no params have values
 */
export function buildQueryString(
  params: Record<string, string | undefined | null>
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null) {
      searchParams.set(key, value);
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}
