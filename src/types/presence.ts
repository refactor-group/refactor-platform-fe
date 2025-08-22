import { RelationshipRole } from './relationship-role';

// Modern TypeScript 5.7+ discriminated union approach (zero runtime overhead)
interface BasePresence {
  userId: string;
  name: string;
  relationship_role: RelationshipRole;
  color: string;
  lastSeen: Date;
}

interface ConnectedPresence extends BasePresence {
  status: 'connected';
  isConnected: true;
}

interface DisconnectedPresence extends BasePresence {
  status: 'disconnected';
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

// Simple utility for awareness data (no runtime validation needed)
export const toUserPresence = (awarenessData: any): UserPresence => {
  return awarenessData.isConnected
    ? { ...awarenessData, status: 'connected' as const }
    : { ...awarenessData, status: 'disconnected' as const };
};