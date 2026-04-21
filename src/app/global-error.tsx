"use client";

import { useEffect } from "react";

const STORAGE_KEY = "__chunk_error_reloaded";

/**
 * Root-level error boundary for the entire app (Next.js convention).
 *
 * Catches ChunkLoadErrors (stale JS bundles requesting renamed chunks
 * after a deploy) and triggers a single hard reload. sessionStorage
 * prevents infinite reload loops if the new build is itself broken.
 *
 * For non-chunk errors, renders a minimal fallback UI with a retry button.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error.name === "ChunkLoadError" ||
    error.message?.includes("Loading chunk") ||
    error.message?.includes("Failed to fetch dynamically imported module");

  useEffect(() => {
    if (!isChunkError) return;

    const hasReloaded = sessionStorage.getItem(STORAGE_KEY);
    if (!hasReloaded) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      window.location.reload();
    } else {
      // Already reloaded once — clear flag so next deploy can retry
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [isChunkError]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#fafafa",
          color: "#1a1a1a",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "420px", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
            Something went wrong
          </h2>
          <p style={{ color: "#666", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
            {isChunkError
              ? "A new version is available. Reloading..."
              : "An unexpected error occurred."}
          </p>
          {!isChunkError && (
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.375rem",
                border: "1px solid #d4d4d4",
                backgroundColor: "#fff",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Try again
            </button>
          )}
        </div>
      </body>
    </html>
  );
}
