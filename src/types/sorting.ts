/**
 * API-compatible sort orders for backend requests
 * @example 'asc' - Ascending order (A-Z, 1-9, oldest first)
 * @example 'desc' - Descending order (Z-A, 9-1, newest first)
 */
export type ApiSortOrder = 'asc' | 'desc';

/**
 * Standard entity audit fields available for sorting across all entities
 */
export type EntitySortField = 'created_at' | 'updated_at';

/**
 * Entity-specific sort fields (matches backend enums exactly)
 * These types ensure type safety and API compatibility
 */
export type CoachingSessionSortField = 'date' | EntitySortField;
export type ActionSortField = 'due_by' | EntitySortField;
export type AgreementSortField = 'body' | EntitySortField;
export type OverarchingGoalSortField = 'title' | EntitySortField;

/**
 * Unified sort order enum for client-side usage
 * Values match backend API requirements exactly
 */
export enum SortOrder {
  Asc = "asc",
  Desc = "desc",
}