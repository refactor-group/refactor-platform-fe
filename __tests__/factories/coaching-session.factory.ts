import type { CoachingSession } from '@/types/coaching-session'

/**
 * Creates a mock CoachingSession for testing purposes.
 *
 * @param overrides - Partial CoachingSession to override default values
 * @returns A complete CoachingSession object with sensible defaults
 *
 * @example
 * const session = createMockCoachingSession({
 *   id: 'session-456',
 *   coaching_relationship_id: 'rel-456'
 * })
 */
export function createMockCoachingSession(
  overrides?: Partial<CoachingSession>
): CoachingSession {
  const now = new Date().toISOString()

  return {
    id: 'session-123',
    coaching_relationship_id: 'rel-123',
    date: now,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}
