"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { sanitizeCallbackUrl } from "@/lib/utils/redirect-utils";

/**
 * Gets the base URL for the current environment
 */
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Client side - use current origin
    return window.location.origin;
  }
  
  // Fallback for server side or testing
  return 'http://localhost:3000';
}

/**
 * Custom hook for handling authentication redirects
 * Manages reading callback URLs from search params and redirecting after login
 */
export function useAuthRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * Redirects user after successful login
   * Uses callbackUrl from search params if valid, otherwise uses fallback
   */
  const redirectAfterLogin = useCallback((fallbackUrl: string = "/dashboard") => {
    // Get callback URL from search parameters
    const callbackUrl = searchParams.get("callbackUrl");
    
    // Sanitize and validate the callback URL with current base URL
    const validCallbackUrl = sanitizeCallbackUrl(callbackUrl, getBaseUrl());
    
    // Use valid callback URL or fallback
    const redirectUrl = validCallbackUrl || fallbackUrl;
    
    console.debug("Redirecting after login to:", redirectUrl);
    router.push(redirectUrl);
  }, [router, searchParams]);

  /**
   * Gets the current callback URL if present and valid
   */
  const getCallbackUrl = useCallback((): string | null => {
    const callbackUrl = searchParams.get("callbackUrl");
    return sanitizeCallbackUrl(callbackUrl, getBaseUrl());
  }, [searchParams]);

  return {
    redirectAfterLogin,
    getCallbackUrl,
  };
}