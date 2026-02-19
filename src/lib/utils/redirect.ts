/**
 * Pure utility functions for handling authentication redirects
 * Uses native URL constructor for robust security against open redirect attacks
 */

/**
 * Validates if a URL is safe for redirecting using native URL constructor
 * Prevents open redirect attacks by ensuring URL is internal to the application
 */
export function validateRedirectUrl(
  url: string,
  baseUrl: string = "http://localhost:3000"
): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    // Use native URL constructor for robust parsing
    const parsed = new URL(url, baseUrl);
    const base = new URL(baseUrl);

    // Only allow same origin (internal) URLs
    const isSameOrigin = parsed.origin === base.origin;

    // Must be a pathname (starts with /) and not just root
    const isValidPath =
      parsed.pathname.startsWith("/") && parsed.pathname !== "/";

    // Reject dangerous protocols that URL constructor might allow
    const isSafeProtocol =
      parsed.protocol === "http:" || parsed.protocol === "https:";

    return isSameOrigin && isValidPath && isSafeProtocol;
  } catch {
    // Invalid URL format
    return false;
  }
}

/**
 * Sanitizes and validates a callback URL for safe redirecting
 * Returns the cleaned URL if valid, null if invalid
 */
export function sanitizeCallbackUrl(
  url: string | null | undefined,
  baseUrl: string = "http://localhost:3000"
): string | null {
  if (!url) {
    return null;
  }

  try {
    // Decode the URL in case it's encoded
    const decodedUrl = decodeURIComponent(url);

    // Validate using native URL constructor
    if (!validateRedirectUrl(decodedUrl, baseUrl)) {
      return null;
    }

    // Extract just the pathname + search + hash for internal redirect
    const parsed = new URL(decodedUrl, baseUrl);
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    // Invalid URL encoding or format
    console.warn("Invalid URL format in callback URL:", url);
    return null;
  }
}

/**
 * Creates a login URL with callback parameter
 */
export function createLoginUrlWithCallback(callbackUrl: string): string {
  const encodedCallback = encodeURIComponent(callbackUrl);
  return `/?callbackUrl=${encodedCallback}`;
}
