/**
 * Pure utility functions for handling authentication redirects
 * These functions don't depend on React and can be used anywhere
 */

/**
 * Validates if a URL is safe for redirecting
 * Prevents open redirect attacks by ensuring URL is internal
 */
export function validateRedirectUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Remove leading/trailing whitespace
  const trimmedUrl = url.trim();
  
  // Must start with / for relative URLs
  if (!trimmedUrl.startsWith('/')) {
    return false;
  }

  // Prevent protocol-relative URLs (//example.com)
  if (trimmedUrl.startsWith('//')) {
    return false;
  }

  // Prevent javascript: or data: URLs
  if (trimmedUrl.toLowerCase().includes('javascript:') || 
      trimmedUrl.toLowerCase().includes('data:')) {
    return false;
  }

  return true;
}

/**
 * Checks if a URL points to an internal route (starts with /)
 */
export function isInternalUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmedUrl = url.trim();
  return trimmedUrl.startsWith('/') && !trimmedUrl.startsWith('//');
}

/**
 * Sanitizes and validates a callback URL for safe redirecting
 * Returns the cleaned URL if valid, null if invalid
 */
export function sanitizeCallbackUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    // Decode the URL in case it's encoded
    const decodedUrl = decodeURIComponent(url);
    
    // Validate the URL
    if (!validateRedirectUrl(decodedUrl)) {
      return null;
    }

    // Additional check: ensure it's not just "/"
    if (decodedUrl === '/') {
      return null;
    }

    return decodedUrl;
  } catch (error) {
    // Invalid URL encoding
    console.warn('Invalid URL encoding in callback URL:', url);
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