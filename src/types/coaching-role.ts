/**
 * Coaching Relationship Role Types
 * Represents a user's role within a specific coaching relationship
 * (distinct from system/organization Role enum)
 */

export const CoachingRole = {
  Coach: 'Coach',
  Coachee: 'Coachee',
} as const;

export type CoachingRole = typeof CoachingRole[keyof typeof CoachingRole];
