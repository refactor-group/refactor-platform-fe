/**
 * Determines if coaching relationship ID should be synced from session data.
 *
 * The URL is the source of truth for the current session. We sync the relationship ID
 * from the session data in two cases:
 * 1. Store is empty (e.g., new tab/window) - fixes Issue #79
 * 2. Store has a different relationship (e.g., navigating between sessions) - fixes Bug #228
 *
 * @param sessionRelationshipId - The relationship ID from the current session
 * @param currentRelationshipId - The relationship ID currently in the store
 * @returns true if we should sync the relationship ID
 *
 * @example
 * // Store is empty (new tab)
 * shouldSyncRelationship('rel-123', null) // returns true
 *
 * @example
 * // Store has different relationship (switching sessions)
 * shouldSyncRelationship('rel-456', 'rel-123') // returns true
 *
 * @example
 * // Store matches session (same relationship)
 * shouldSyncRelationship('rel-123', 'rel-123') // returns false
 *
 * @example
 * // Session has no relationship (incomplete data)
 * shouldSyncRelationship(undefined, 'rel-123') // returns false
 */
export function shouldSyncRelationship(
  sessionRelationshipId: string | undefined,
  currentRelationshipId: string | null
): boolean {
  if (!sessionRelationshipId) return false
  // Always sync when empty (new tab) or when different (switching sessions)
  return !currentRelationshipId || sessionRelationshipId !== currentRelationshipId
}
