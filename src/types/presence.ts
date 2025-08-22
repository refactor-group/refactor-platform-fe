import { RelationshipRole } from './relationship-role';

// Presence status type
export type PresenceStatus = 'connected' | 'disconnected';

// Raw awareness data structure from collaboration provider
export interface AwarenessData {
  userId: string;
  name: string;
  relationship_role: RelationshipRole;
  color: string;
  isConnected: boolean;
}

// Modern TypeScript 5.7+ discriminated union approach (zero runtime overhead)
interface BasePresence {
  userId: string;
  name: string;
  relationship_role: RelationshipRole;
  color: string;
  lastSeen: Date;
}

interface ConnectedPresence extends BasePresence {
  status: Extract<PresenceStatus, 'connected'>;
  isConnected: true;
}

interface DisconnectedPresence extends BasePresence {
  status: Extract<PresenceStatus, 'disconnected'>;
  isConnected: false;
}

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

// Type-safe utility for awareness data transformation (zero runtime overhead)
export const toUserPresence = (awarenessData: AwarenessData): UserPresence => {
  const { userId, name, relationship_role, color, isConnected } = awarenessData;
  
  return isConnected
    ? { userId, name, relationship_role, color, isConnected: true, status: 'connected' as const, lastSeen: new Date() }
    : { userId, name, relationship_role, color, isConnected: false, status: 'disconnected' as const, lastSeen: new Date() };
};