import { RelationshipRole } from './relationship-role';

/**
 * User Presence & Awareness System
 * 
 * This file defines two complementary concepts:
 * 
 * 1. **AwarenessData** - TipTap's collaboration protocol format
 *    - Raw data structure received from TipTap's awareness events
 *    - Simple boolean `isConnected` field for transport efficiency
 *    - Matches TipTap's naming conventions and data structure
 *    - Used at integration boundaries with the collaboration provider
 * 
 * 2. **UserPresence** - Our domain-specific presence model  
 *    - Enriched with business logic (timestamps, discriminated unions)
 *    - Type-safe operations through discriminated unions
 *    - Zero runtime overhead with TypeScript's type system
 *    - Used throughout our application for UI logic and state management
 * 
 * The separation allows us to:
 * - Follow TipTap's conventions at the integration layer
 * - Apply domain-specific logic and type safety in our application
 * - Maintain clean architecture boundaries between transport and business logic
 */

// Presence status type for discriminated union
export type PresenceStatus = 'connected' | 'disconnected';

/**
 * TipTap Awareness Data - Transport Layer
 * 
 * Raw awareness data structure from TipTap collaboration provider.
 * This represents the protocol-level data synchronized across all connected clients.
 * 
 * @see https://tiptap.dev/docs/collaboration/core-concepts/awareness
 */
export interface AwarenessData {
  userId: string;
  name: string;
  relationshipRole: RelationshipRole;
  color: string;
  isConnected: boolean; // Simple boolean from TipTap's awareness protocol
}

/**
 * User Presence - Domain Layer
 * 
 * Domain-specific presence model that enriches AwarenessData with:
 * - Business logic: `lastSeen` timestamp for UI display
 * - Type safety: Discriminated unions prevent invalid states
 * - Zero runtime overhead: TypeScript-only type checking
 * 
 * Key differences from AwarenessData:
 * - AwarenessData: Simple boolean `isConnected` (transport layer)
 * - UserPresence: Type-safe discriminated union with `status` + `isConnected`
 * - Adds `lastSeen` timestamp for business logic needs
 * - Provides compile-time guarantees about connection state
 */

interface BasePresence {
  userId: string;
  name: string;
  relationshipRole: RelationshipRole;
  color: string;
  lastSeen: Date; // Business logic addition: track when user was last seen
}

interface ConnectedPresence extends BasePresence {
  status: Extract<PresenceStatus, 'connected'>;
  isConnected: true; // Type-safe: always true when status is 'connected'
}

interface DisconnectedPresence extends BasePresence {
  status: Extract<PresenceStatus, 'disconnected'>;
  isConnected: false; // Type-safe: always false when status is 'disconnected'
}

/**
 * Discriminated union for type-safe presence operations
 * TypeScript automatically narrows types based on status/isConnected
 */
export type UserPresence = ConnectedPresence | DisconnectedPresence;

export interface PresenceState {
  users: Map<string, UserPresence>;
  currentUser: UserPresence | null;
  isLoading: boolean;
}

// Factory functions (idiomatic for controlled data creation)
export const createConnectedPresence = (
  base: Omit<BasePresence, 'lastSeen'>
): ConnectedPresence => ({
  ...base,
  status: 'connected',
  isConnected: true,
  lastSeen: new Date()
});

export const createDisconnectedPresence = (
  presence: ConnectedPresence
): DisconnectedPresence => ({
  ...presence,
  status: 'disconnected',
  isConnected: false,
  lastSeen: new Date()
});

/**
 * Transform TipTap awareness data to domain presence model
 * 
 * Converts transport-layer AwarenessData to business-logic UserPresence:
 * - Adds `lastSeen` timestamp for UI needs
 * - Converts boolean `isConnected` to discriminated union
 * - Provides type safety for connection state operations
 * 
 * @param awarenessData - Raw awareness data from TipTap collaboration provider
 * @returns Type-safe UserPresence with business logic enhancements
 */
export const toUserPresence = (awarenessData: AwarenessData): UserPresence => {
  const { userId, name, relationshipRole, color, isConnected } = awarenessData;

  return isConnected
    ? { userId, name, relationshipRole, color, isConnected: true, status: 'connected' as const, lastSeen: new Date() }
    : { userId, name, relationshipRole, color, isConnected: false, status: 'disconnected' as const, lastSeen: new Date() };
};