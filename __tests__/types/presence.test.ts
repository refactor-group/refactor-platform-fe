import {
  createConnectedPresence,
  createDisconnectedPresence,
  toUserPresence,
  type UserPresence
} from '@/types/presence';
import { RelationshipRole } from '@/types/relationship-role';

describe('Presence Types', () => {
  describe('createConnectedPresence', () => {
    it('creates a connected presence with correct properties', () => {
      const base = {
        userId: 'user1',
        name: 'John Doe',
        relationship_role: RelationshipRole.Coach,
        color: '#ffcc00'
      };

      const presence = createConnectedPresence(base);

      expect(presence.status).toBe('connected');
      expect(presence.isConnected).toBe(true);
      expect(presence.userId).toBe('user1');
      expect(presence.name).toBe('John Doe');
      expect(presence.relationship_role).toBe(RelationshipRole.Coach);
      expect(presence.color).toBe('#ffcc00');
      expect(presence.lastSeen).toBeInstanceOf(Date);
    });

    it('creates presence for coachee role', () => {
      const base = {
        userId: 'user2',
        name: 'Jane Smith',
        relationship_role: RelationshipRole.Coachee,
        color: '#00ccff'
      };

      const presence = createConnectedPresence(base);

      expect(presence.relationship_role).toBe(RelationshipRole.Coachee);
      expect(presence.status).toBe('connected');
    });
  });

  describe('createDisconnectedPresence', () => {
    it('converts connected presence to disconnected', () => {
      const connectedPresence = createConnectedPresence({
        userId: 'user1',
        name: 'John Doe',
        relationship_role: RelationshipRole.Coach,
        color: '#ffcc00'
      });

      const disconnectedPresence = createDisconnectedPresence(connectedPresence);

      expect(disconnectedPresence.status).toBe('disconnected');
      expect(disconnectedPresence.isConnected).toBe(false);
      expect(disconnectedPresence.userId).toBe(connectedPresence.userId);
      expect(disconnectedPresence.name).toBe(connectedPresence.name);
      expect(disconnectedPresence.relationship_role).toBe(connectedPresence.relationship_role);
      expect(disconnectedPresence.color).toBe(connectedPresence.color);
      expect(disconnectedPresence.lastSeen).toBeInstanceOf(Date);
      expect(disconnectedPresence.lastSeen.getTime()).toBeGreaterThanOrEqual(
        connectedPresence.lastSeen.getTime()
      );
    });
  });

  describe('toUserPresence', () => {
    it('converts awareness data with isConnected: true to connected presence', () => {
      const awarenessData = {
        userId: 'user1',
        name: 'John Doe',
        relationship_role: RelationshipRole.Coach,
        color: '#ffcc00',
        isConnected: true,
        lastSeen: new Date()
      };

      const presence = toUserPresence(awarenessData);

      expect(presence.status).toBe('connected');
      expect(presence.isConnected).toBe(true);
      expect(presence.userId).toBe('user1');
    });

    it('converts awareness data with isConnected: false to disconnected presence', () => {
      const awarenessData = {
        userId: 'user1',
        name: 'John Doe',
        relationship_role: RelationshipRole.Coach,
        color: '#ffcc00',
        isConnected: false,
        lastSeen: new Date()
      };

      const presence = toUserPresence(awarenessData);

      expect(presence.status).toBe('disconnected');
      expect(presence.isConnected).toBe(false);
      expect(presence.userId).toBe('user1');
    });
  });
});